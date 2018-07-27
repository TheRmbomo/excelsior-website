const fs = require('fs')
const path = require('path')
const express = require('express')
const {ObjectID} = require('mongodb')
const hbs = require('hbs')
const scrypt = require('scrypt')
const valid = require('validator')
const passport = require('passport')
const uuid = require('uuid/v4')
const uuidParse = require('uuid-parse').parse

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId, loginCB} = require('./../middleware/passport')

var defaultAvatar = '/img/default_avatar.png'

app.get('/logout', (req, res) => {
  console.log('Logged out')
  req.logout()
  res.locals['logged-in'] = false
  res.redirect('/login')
})

app.route('/create-user')
.get((req, res) => res.redirect('back'))
.post(async (req, res, next) => {
  req.logout()
  let {email, password} = req.body, error = {}

  if (!email) error.email = {type: 'required'}
  else if (!valid.isEmail(email + '')) error.email = {type: 'invalid'}
  else {
    let emailsReq = await pgQuery('SELECT unnest(emails) FROM users')
    .catch(e => console.log(Error(e)))
    for (var i=emailsReq.rows.length-1; i>=0; i--) {
      if (emailsReq.rows[i].unnest === email) error.email = {type: 'taken'}
    }
  }
  if (!password) error.password = {type: 'required'}
  else if (!valid.isLength(password + '', {min: 6})) error.password = {type: 'length'}
  if (Object.keys(error).length) return next(JSON.stringify(error))

  let sctParams = await scrypt.params(0.5).catch(error => {return {error}})
  if (sctParams.error) {
    // Generating Scrypt Parameters
    // do a thing, maybe send static req property for error
    return console.log(sctParams.error)
  }
  let kdfRes = await scrypt.kdf(password, sctParams)
  let q = await pgQuery(`INSERT INTO users (emails, hashed_password)
  values (ARRAY[$1],$2) RETURNING id`, [email, kdfRes])
  .catch(e => {
    console.log(Error(e))
    return next()
  })
  let user = q.rows[0]

  console.log('PLACEHOLDER: Email sent')
  user.shortened_id = shortenId(user.id)

  req.login(user, err => {
    if (err) return next(err)

    console.log(req.user)
    return res.redirect(`/user/user-${req.user.shortened_id.toString('hex')}`)
  })
  return res.redirect('back')
})

app.get('/login-user', (req, res) => {
  res.redirect('back')
})

app.get('/login', (req, res) => {
  console.log('req.session.passport =', req.session.passport)
  res.render('login', {
    title: 'Sign-in'
  })
})

app.get('/users', async (req, res, next) => {
  let data = {}

  let q = await pgQuery(`SELECT display_name, username, shortened_id, avatar_path FROM users`)
  .catch(e => {
    console.log(Error(e))
    return next()
  })
  q.rows.map(user => {
    user.shortened_id = user.shortened_id.toString('hex')
    if (!user.avatar_path) user.avatar_path = defaultAvatar
    if (!user.username) user.username = 'user'
  })
  data.users = q.rows

  res.render('multilist', {
    title: 'Multiple Results',
    data
  })
})

var userRouter = express.Router()
app.use('/user/:id', async (req, res, next) => {
  var {id} = req.params
  id = id.split('-')
  id.splice(2)
  if (!id[0]) return next()

  var q

  if (id.length === 1) {
    return next()
  } else if (id[0] === 'user') {
    q = await pgQuery(`SELECT id, shortened_id FROM users
    WHERE shortened_id=$1 AND username IS NULL;`, [new Buffer(id[1], 'hex')])
    .then(q => {
      if (!q.rows.length) return
      return q
    })
    .catch(e => {
      console.log(Error(e))
      return
    })
  } else {
    q = await pgQuery(`SELECT id, shortened_id FROM users
      WHERE username=$1 AND shortened_id=$2;`, [id[0], new Buffer(id[1], 'hex')])
    .then(q => {
      if (!q.rows.length) return
      return q
    })
    .catch(e => {
      console.log(Error(e))
      q = undefined
    })
  }
  if (!q || !q.rows.length) return next()

  let user = q.rows[0]
  user.url = `${id[0]}-${user.shortened_id.toString('hex')}`

  if (!user) return next()

  q = await pgQuery(`SELECT username, mongo_id, first_name, last_name,
  display_name, avatar_path, age, friends, currency, created_at
  FROM users WHERE id=$1`, [user.id])
  .catch(e => console.log(Error(e)))
  Object.assign(user, q.rows[0])

  user.created_at = req.format_date(user.created_at)
  user.avatar_path = user.avatar_path || defaultAvatar
  req.viewedUser = user

  Object.assign(res.locals, {
    user,
    own_page: (req.user) ? id[1] === req.user.shortened_id : false,
    title: (user && user.display_name) ? user.display_name : 'User Profile'
  })
  next()
}, userRouter)

userRouter.get('/', async (req, res, next) => {
  let user = req.viewedUser
  if (!user) return next()

  res.render('user_profile')
})

userRouter.get('/edit', (req, res, next) => {
  let user = req.viewedUser
  if (!user) return next()

  if (user.id !== req.user.id) return res.redirect(`/user/${user.url}`)

  res.render('user_profile_edit', {
    edit: true
  })
})

userRouter.get('/paths', (req, res, next) => {
  let user = req.viewedUser
  if (!user) return next()

  // TODO: If user has made this page private, return next()

  let listings = [], no_paths = false,
  list_paths = rows => {
    let paths = rows.reduce((text, row) => {
      row.last_modified = req.format_date(row.last_modified)
      row.description = 'This is a description of a legendary path of learning that will be sure to wow and amaze even the most skeptical and cynical of readers.'
      if (!row.name || !row.shortened_id) return text
      row.url = `/path/${row.name}-${row.shortened_id.toString('hex')}`
      if (row.description.length > 80) row.description = row.description.slice(0,80).trim() + '...'
      return text + hbs.compile('{{> path_listing}}')(row)
    }, '')
    return paths
  }

  Promise.all([
    pgQuery(`SELECT shortened_id, name, display_name, image_path, last_modified
    FROM paths WHERE created_by=$1 ORDER BY last_modified DESC;`, [req.viewedUser.id])
    .then(q => {
      if (!q.rows.length) no_paths = true
      return q.rows
    })
    .then(list_paths)
    .then(paths => {
      let message
      if (req.user && req.viewedUser.id === req.user.id) message = `You haven't `
      else message = `They haven't `
      message += 'created any paths yet.'
      if (!paths) paths = `<div class="tr">
      <div class="td center round dark background padding">${message}</div>
      </div>`
      paths = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${paths}</div>`)
      listings.push({group_name: `${req.viewedUser.display_name}'s Paths`, paths})
    }),
    pgQuery(`SELECT shortened_id, name, display_name, image_path, last_modified
    FROM paths WHERE id = ANY((SELECT path_keys FROM users WHERE id=$1)::uuid[])
    ORDER BY last_modified DESC;`, [req.viewedUser.id])
    .then(q => {
      if (!q.rows.length) no_paths = true
      return q.rows
    })
    .then(list_paths)
    .then(paths => {
      let message
      if (req.user && req.viewedUser.id === req.user.id) message = `You aren't `
      else message = `They aren't `
      message += 'managing any one\'s paths yet.'
      if (!paths) paths = `<div class="tr">
      <div class="td center round dark background padding">${message}</div>
      </div>`
      paths = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${paths}</div>`)
      listings.push({group_name: `Managed Paths`, paths})
    }),
    pgQuery(`SELECT shortened_id, name, display_name, image_path, last_modified
    FROM paths WHERE id = ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])
    ORDER BY last_modified DESC;`, [req.viewedUser.id])
    .then(q => {
      if (!q.rows.length) no_paths = true
      return q.rows
    })
    .then(list_paths)
    .then(paths => {
      let message
      if (req.user && req.viewedUser.id === req.user.id) message = `You aren't `
      else message = `They aren't `
      message += 'following any paths yet.'
      if (!paths) paths = `<div class="tr">
      <div class="td center round dark background padding">${message}</div>
      </div>`
      paths = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${paths}</div>`)
      listings.push({group_name: `Followed Paths`, paths})
    })
  ])
  .then(() => {
    listings = listings.reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> path_group}}')(group))
    }, '')

    return res.render('list_paths', {
      title: 'Your Paths of Learning',
      listings,
      no_paths
    })
  })
  .catch(e => {
    console.log(Error(e))
    return res.send()
  })
})

app.post('/edit-profile', express.json(), express.urlencoded({extended: true}), async (req, res) => {
  if (!req.user) return res.redirect('/login')

  let error = {}, bodyKeys = Object.keys(req.body)
  bodyKeys.map(key => {
    switch (key) {
      case 'first_name':
        if (req.body[key]) break
        error[key] = {type: 'required'}
      case 'avatar':
        // console.log(req.body[key]);
        delete req.body[key]
        bodyKeys.splice(bodyKeys.indexOf(key), 1)
        if (key === 'first_name') break
        req.body['avatar_path'] = ''
        bodyKeys.push('avatar_path')
        return
      case 'username':
        req.body[key] = req.body[key].split(/\W/).join('')
        if (!req.body[key]) req.body[key] = null
        break
    }
  })
  let update_keys = bodyKeys.map(key => `${key}`).join(','),
  update_values = Object.values(req.body).map(value => value ? value.trim() : null),
  update_values_spot = (length => {
    // +1 and >2 to make room for the user id
    for (var i=length+1, array=[]; array.push('$'+i), i>2; i--)
    ;return array.reverse().join(',')
  })(bodyKeys.length)

  if (bodyKeys.length > 1) {
    update_keys = `(${update_keys})`
    update_values_spot = `(${update_values_spot})`
  }
  let update = `${update_keys}=${update_values_spot}`
  let parameters = [req.user.id].concat(update_values), user
  // console.log(update, parameters)
  let q = await pgQuery(`UPDATE users SET ${update} WHERE id=$1
  RETURNING username, shortened_id;`, parameters)
  .then(q => q.rows)
  .then(rows => {
    if (!rows.length) throw 'Failed to update user'
    user = rows[0]
    user.shortened_id = user.shortened_id.toString('hex')
    return res.redirect(`/user/${user.username || 'user'}-${user.shortened_id}/edit`)
  })
  .catch(e => {
    console.log(Error(e))
    return res.redirect('back')
  })
})

app.get('/my-files', async (req, res) => {
  if (!req.user) return res.redirect('/login')

  let q, full = false, files
  q = await pgQuery(`SELECT id AS image_id, name, path, size, type, created_at,
  times_accessed, last_accessed FROM files WHERE owner=$1;`, [req.user.id])
  .catch(e => {
    console.log(Error(e))
    return res.redirect('back')
  })

  let taken_space = q.rows.reduce((acc,cur) => acc + cur.size, 0)
  if (taken_space >= 1024 * 1024 * 5) full = true

  files = q.rows
  files.map(file => Object.keys(file).map(key => {
    switch (key) {
      case 'size':
        file[key] = Math.floor(file[key]/(1024*1024) * 100) / 100
        file[key] += ' MB'
        break
      case 'created_at':
      case 'last_accessed':
        file[key] = req.format_date(file[key])
        break
      case 'type':
        if (file[key].substr(0,5) !== 'image') {
          file['path'] = '/img/default_file.png'
        }
    }
  }))

  taken_space = Math.floor(taken_space/(1024 * 1024) * 1000) / 1000

  res.render('my_files.hbs', {
    title: 'My Files',
    taken_space,
    remaining_space: Math.floor((5 - taken_space) * 1000) / 1000,
    files
  })
})

app.post('/upload-file', async (req, res) => {
  res.redirect('back')
  if (!req.user) return

  q = await pgQuery(`SELECT id AS image_id, name, path, size, type, created_at,
  times_accessed, last_accessed FROM files WHERE owner=$1;`, [req.user.id])
  .catch(e => {
    console.log(Error(e))
    return res.redirect('back')
  })

  let taken_space = q.rows.reduce((acc,cur) => acc + cur.size, 0)
  if (taken_space >= 1024 * 1024 * 5) return

  let upload = await require('./../middleware/formidable')(req,res)
  if (upload.error) return
  console.log(upload);
  if (upload.files[0].size + taken_space >= 1024 * 1024 * 5) {
    fs.unlink(path.join(app.locals.absoluteDir, 'public/', 'files/', upload.filename), err => err)
    return
  }
  let file = upload.files[0], filePath = '/'

  if (file.type.substr(0,5) === 'image') {
    fs.rename(path.join(app.locals.public, 'files/', upload.filename), path.join(app.locals.public, 'img/', upload.filename), err => err)
    filePath += 'img/'
  }

  pgQuery(`INSERT INTO files (name, owner, path, size, type)
  values ($1, $2, $3, $4, $5);`, [file.name,req.user.id,`${filePath}${upload.filename}`,file.size,file.type])
  .catch(e => {
    // fs.unlink()
    console.log(Error(e))
  })
})

app.post('/delete-file', express.json(), express.urlencoded({extended: true}), (req, res) => {
  res.redirect('back')
  if (!req.user) return
  let {image_id, file_name} = req.body

  if (req.body['change-avatar']) {
    pgQuery('UPDATE users SET avatar_path=$2 WHERE id=$1', [req.user.id, file_name])
    .catch(e => console.log(Error(e)))
    return
  }

  if (req.user.avatar_path === file_name) {
    pgQuery('UPDATE users SET avatar_path=NULL WHERE id=$1', [req.user.id])
    .catch(e => console.log(Error(e)))
  }

  pgQuery('SELECT owner, path FROM files WHERE id=$1', [image_id])
  .then(a => a.rows[0]).then(async row => {
    if (row.owner === req.user.id) {
      let error;
      await fs.unlink(path.join(app.locals.absoluteDir, '/public', row.path), err => (err) ? error = err : '')
      if (error && error.errno !== -4058) throw error
      pgQuery('DELETE FROM files WHERE id=$1', [image_id])
      .catch(e => console.log(Error(e)))
    } else console.log('Not the owner')
  })
  .catch(e => console.log(Error(e)))
})
