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
const {shortenId, createUser} = require('./../middleware/passport')
const formidable = require('./../middleware/formidable')
const {sanitize} = require('./../middleware/utilities')
const User = require('./../db/models/user')
const {listResults, pathGroup, objectPage} = require('./web-routes')

var defaultAvatar = '/img/default_avatar.png'

app.get('/logout', (req, res) => {
  console.log('Logged out')
  req.logout()
  res.locals['logged-in'] = false
  res.redirect('/login')
})

app.route('/create-user')
.get((req, res) => res.redirect('back'))
.post(formidable(), (req, res, next) => {
  req.logout()
  var newUser = req.body, error = {}, is_error = () => Object.keys(error).length

  return new Promise((resolve, reject) => {
    if (!newUser.email) error.email = {type: 'required'}
    else if (!valid.isEmail(newUser.email + '')) error.email = {type: 'invalid'}
    // else if (!newUser.agreement) error.agreement = {type: 'required'}
    else {
      pgQuery('SELECT $1=ANY((SELECT unnest(emails) FROM users)) AS taken', [newUser.email])
      .then(q => q.rows[0])
      .then(res => {
        if (res.taken) error.email = {type: 'taken'}
      })
      .then(() => resolve())
      .catch(e => reject(e))
      return
    }
    return resolve()
  })
  .then(() => {
    if (!newUser.password) error.password = {type: 'required'}
    else if (!valid.isLength(newUser.password + '', {min: 6, max: 512})) error.password = {type: 'length', min: 6, max: 512}
    else if (newUser.password !== newUser.confirm_password) error.confirm_password = {type: 'not_matching'}

    try {
      newUser.display_name = sanitize('display_name', newUser.display_name)
      newUser.username = sanitize('username', newUser.display_name)

      let names = newUser.full_name.trim().split(' ').filter(i => !!i)
      newUser.first_name = sanitize('text', names[0])
      newUser.last_name = sanitize('text', names[1])
    } catch (e) {throw e}
    if (is_error()) throw error
    return scrypt.params(0.5)
  })
  .then(params => scrypt.kdf(newUser.password, params))
  .then(kdfRes => createUser({
    properties: ['emails', 'hashed_password', 'display_name', 'username', 'first_name', 'last_name'],
    values: ['ARRAY[$1]','$2','$3','$4','$5','$6'],
    params: [newUser.email, kdfRes, newUser.display_name, newUser.username,
    newUser.first_name, newUser.last_name],
    returning: 'id, username'
  }))
  .then(user => req.login(user, err => {
    if (err) {
      errorlog(err)
      return next('nf')
    }
    res.redirect(`/user/${user.username}-${user.shortened_id.toString('hex')}`)
  }))
  .catch(e => {
    errorlog(e)
    res.redirect('back')
  })
})

app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Sign-in',
    lastPage: req.query.page
  })
})

app.get('/signup', (req, res) => res.render('signup', {
  title: 'Creating a User',
  email: req.query.email
}))

app.get('/users', (req, res, next) => {
  pgQuery(`SELECT display_name, username, shortened_id, avatar_path FROM users`)
  .then(q => q.rows)
  .then(users => {
    users.map(user => {
      user.shortened_id = user.shortened_id.toString('hex')
      if (!user.avatar_path) user.avatar_path = defaultAvatar
      if (!user.username) user.username = 'user'
    })
    res.render('multilist', {
      title: 'Multiple Results',
      data: {users}
    })
  })
  .catch(e => {
    errorlog(e)
    return next('nf')
  })
})

var userRouter = express.Router()
app.use('/user/:id', objectPage({
  type: 'user',
  properties: `id, shortened_id, username, first_name, last_name,
  display_name, avatar_path, TO_CHAR(birthday, 'yyyy-mm-dd') AS birthday, friends, currency, created_at`,
  condition: 'WHERE username=$1 AND shortened_id=$2',
  model: User
}), (req, res, next) => {
  req.page.then(user => {
    Object.assign(user, {
      name: user.first_name + ((user.first_name && user.last_name) ? ' ' + user.last_name : user.last_name),
      url: `/user/${user.username}-${user.shortened_id}`,
      created_at: req.format_date(user.created_at),
      avatar_path: user.avatar_path || defaultAvatar,
      own: (req.user && req.user.id === user.id)
    })

    res.locals.user = user
    next()
  })
  .catch(e => {
    errorlog(e);
    next('nf')
  })
}, userRouter)

userRouter.get('/', (req, res, next) => {
  var user = res.locals.user

  res.render('user', {
    title: (user.display_name) ? user.display_name : 'User Profile'
  })
})

userRouter.get('/edit', (req, res, next) => {
  if (!req.user) return next('auth')

  var user = res.locals.user
  if (user.id !== req.user.id) return res.redirect(`/user/${user.url}`)

  user.is_public ? (user.is_public = 'checked') : (user.is_private = 'checked', user.is_public = '')

  res.render('settings', {
    header: 'User',
    type: 'user',
    page: 'user_edit',
    title: 'Editing Profile'
  })
})

userRouter.delete('/delete', (req, res, next) => {
  if (!req.user) return next('auth')
  var user = res.locals.user
  Promise.all([
    pgQuery(`DELETE FROM users WHERE id=$1`, [user.id]),
    User.deleteOne({_id: user.id})
  ])
  .then(q => res.json({
    message: 'Successfully deleted',
    display_name: user.display_name,
    url: user.url
  }))
  .catch(e => (errorlog(e), res.status(500).send('Server Error')))
})

userRouter.get('/paths', (req, res, next) => {
  var user = res.locals.user
  if (!user) return next('nf')

  // TODO: If user has made this page private, return next()

  var perspective = (req.user && req.user.id === user.id) ? 'You' : 'They',
  own = req.user ? req.user.id === user.id : false

  Promise.all([
    pathGroup(req, listResults, {
      group_name: (req.user && req.user.id === user.id) ?
      'Your Paths' : `${user.display_name}'s Paths`,
      condition: 'WHERE created_by=$1',
      params: [user.id],
      empty_message: `${perspective} haven\'t created any paths yet.`,
      visible: own || user.show_createdPaths
    }).catch(e => (errorlog(e), null)),
    pathGroup(req, listResults, {
      group_name: 'Currently Following',
      condition: 'WHERE id = ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])',
      params: [user.id],
      empty_message: `${perspective} aren\'t following anyone\'s paths yet.`,
      visible: own || user.show_followedPaths
    }).catch(e => (errorlog(e), null))
  ])
  .then(listings => {
    listings = listings.filter(i => !!i).reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> results_group}}')(group))
    }, '')
    return res.render('list_results', {
      title: 'Your Paths of Learning',
      back: {url: user.url},
      type: 'path',
      create: 'Create a Path of Learning',
      listings,
      js: 'list_paths'
    })
  })
  .catch(e => {
    errorlog(e)
    return next('nf')
  })
})

/*
app.get('/my-files', (req, res, next) => {
  if (!req.user) return res.redirect('/login')

  var full = false, files
  pgQuery(`SELECT id AS image_id, name, path, size, type, created_at,
  times_accessed, last_accessed FROM files WHERE owner=$1;`, [req.user.id])
  .then(q => q.rows)
  .then(files => {
    var taken_space = files.reduce((acc,cur) => acc + cur.size, 0)
    if (taken_space >= 1024 * 1024 * 5) full = true

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
  .catch(e => {
    errorlog(e)
    return next('nf')
  })
})

app.post('/upload-file', (req, res, next) => {
  if (!req.user) return next('auth')

  pgQuery(`SELECT id AS image_id, name, path, size, type, created_at,
  times_accessed, last_accessed FROM files WHERE owner=$1;`, [req.user.id])
  .then(q => q.rows)
  .then(rows => {
    var taken_space = rows.reduce((acc,cur) => acc + cur.size, 0)
    if (taken_space >= 1024 * 1024 * 5) return null

    return require('./../middleware/formidable')(req,res)
  })
  .then(upload => {
    if (!upload || upload.error) throw `Upload Error: ${
      (upload && upload.error) ? upload.error : 'Cancelled'
    }`

    if (upload.files[0].size + taken_space >= 1024 * 1024 * 5) {
      let filePath = path.join(app.locals.absoluteDir, 'public/', 'files/', upload.filename)
      return fs.unlink(filePath, err => errorlog(err))
    }
    var file = upload.files[0], filePath = '/'

    if (file.type.substr(0,5) === 'image') {
      let oldPath = path.join(app.locals.public, 'files/', upload.filename),
      newPath = path.join(app.locals.public, 'img/', upload.filename)
      fs.rename(oldPath, newPath, err => errorlog(err))
      filePath += 'img/'
    }

    pgQuery(`INSERT INTO files (name, owner, path, size, type)
    values ($1, $2, $3, $4, $5);`, [file.name,req.user.id,`${filePath}${upload.filename}`,file.size,file.type])
    return
  })
  .then(() => res.redirect('back'))
  .catch(e => {
    errorlog(e)
    return next('nf')
  })
})

app.post('/delete-file', express.json(), express.urlencoded({extended: true}), (req, res, next) => {
  if (!req.user) return next('auth')
  var {image_id, file_name} = req.body

  if (req.body['change-avatar']) {
    return pgQuery('UPDATE users SET avatar_path=$2 WHERE id=$1', [req.user.id, file_name])
    .then(q => res.redirect('back'))
    .catch(e => errorlog(e))
  }

  if (req.user.avatar_path === file_name) {
    pgQuery('UPDATE users SET avatar_path=NULL WHERE id=$1', [req.user.id])
    .catch(e => errorlog(e))
  }

  pgQuery('SELECT owner, path FROM files WHERE id=$1', [image_id])
  .then(q => q.rows[0])
  .then(file => {
    if (req.user.id !== file.owner) throw ''
    return new Promise((resolve, reject) => fs.unlink(path.join(app.locals.absoluteDir,
    '/public', file.path), err => err ? reject(err) : resolve()))
  })
  .then(() => pgQuery('DELETE FROM files WHERE id=$1', [image_id]))
  .then(() => res.redirect('back'))
  .catch(e => {
    errorlog(e)
    next('nf')
  })
})
*/
