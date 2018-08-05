const events = require('events')
const express = require('express')
const valid = require('validator')
const hbs = require('hbs')

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const Path = require('./../db/models/path')

var err = e => console.log(Error(e)),
listPaths = (rows, req) => rows.reduce((promise, path) => promise.then(text => {
  if (!path.name || !path.shortened_id) return text

  path.following = (req.user && req.user.paths_following && req.user.paths_following.indexOf(path.id) !== -1),
  path.last_modified_at = req.format_date(path.last_modified_at)
  path.url = `/path/${path.name}-${path.shortened_id.toString('hex')}`
  if (path.created_by !== '00000000-0000-0000-0000-000000000000') {
    return pgQuery(`SELECT id, display_name, username, shortened_id FROM users
    WHERE id=$1`, [path.created_by])
    .then(q => {
      if (q.rows[0]) return q.rows[0]

      pgQuery(`UPDATE paths SET created_by='00000000-0000-0000-0000-000000000000'
      WHERE id=$1`, [path.id])
      .catch(e => err(e))
      path.author = new hbs.SafeString('<span style="font-size: 0.8em;">[Deleted User]</span><br>')
      throw ''
    })
    .then(user => {
      path.author = user.display_name || user.username || user.shortened_id.toString('hex')
      if (path.author.length > 16) path.author = path.author.slice(0,16).trim() + '...'
      path.owned = (req.user) ? (req.user.id === user.id) : false
    })
    .then(() => {
      path.author = new hbs.SafeString('<span style="white-space: nowrap;">By: '
    + hbs.Utils.escapeExpression(path.author) + '</span><br>')
      return text
    })
    .catch(e => text)
  }
  else {
    path.author = new hbs.SafeString('<span style="font-size: 0.8em;"><em>[By Deleted User]</em></span><br>')
    return text
  }
})
.then(text => Path.findById(path.mongo_id).then(doc => {
  var description = (doc) ? doc.description : ''
  if (description.length > 85) description = description.slice(0, 85).trim() + '...'
  if (!description) description = new hbs.SafeString('<em style="font-size: 0.8em">[No Description]</em>')
  path.description = description
  return text
}))
.then(text => text + hbs.compile(`{{> path_listing}}`)(path)), Promise.resolve(''))
.catch(e => err(e)),
pathGroup = (req, listings, listPaths, opt) => new Promise((resolve, reject) => {
  // Setting defaults
  opt = Object.assign({
    properties: `id, created_by, shortened_id, name, display_name, image_path, last_modified_at,
    mongo_id, rating`,
    require_loggedin: false,
    condition: '',
    order: 'ORDER BY last_modified_at DESC',
    params: [],
    group_name: 'Path Group',
    empty_message: 'No paths were found.',
    listing_index: listings.push('') - 1
  }, opt)
  if (!req) throw 'Request required'
  if (opt.require_loggedin && !req.user) {
    listings.splice(opt.listing_index, 1)
    reject('Not signed in.')
  }
  return pgQuery(`SELECT ${opt.properties} FROM paths ${opt.condition} ${opt.order}`, opt.params)
  .then(q => resolve(q.rows))
  .catch(e => reject(e))
})
.then(rows => rows ? listPaths(rows, req) : null)
.then(paths => {
  if (!paths) {
    paths = `<div class="tr">
    <div class="td center round dark background padding">${opt.empty_message}</div>
    </div>`
  }
  paths = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${paths}</div>`)
  listings[opt.listing_index] = {group_name: opt.group_name, paths}
  return
})

module.exports.listPaths = listPaths
module.exports.pathGroup = pathGroup

app.get('/', (req, res) => {
  // pgQuery('UPDATE users SET emails=array_append(emails,$2) WHERE id=$1', ['def765af-4fb5-4477-9e21-0f7d24ec29c2','a@c.com'])
  res.render('index', {
    title: 'Excelsior, the education and curation platform that fits you',
    message: (req.user) ? '' : 'Welcome to Excelsior'
  })
})

app.get('/questions', (req, res) => {
  pgQuery(`SELECT id, first_name, last_name, question, asked_at,
  answer, answered_by, answered_at
  FROM questions ORDER BY asked_at DESC;`)
  .then(q => q.rows)
  .then(questions => {
    questions.map(question => {
      question.asked_at = req.format_date(question.asked_at, true)
      if (question.answered_at) question.answered_at = req.format_date(question.answered_at, true)
    })

    res.render('questions', {
      title: 'Questions Page',
      questions
    })
  })
  .catch(e => console.log(Error(e)))
})

app.post('/answer-question', express.json(), express.urlencoded({extended: true}),
(req, res) => {
  pgQuery(`UPDATE questions SET (answer,answered_by,answered_at)=($2,$3,now())
  WHERE id=$1;`, [req.body.id, req.body.answer, req.body.answered_by])
  .then(() => res.redirect('back'))
  return
})
app.post('/delete-answer', express.json(), express.urlencoded({extended: true}),
(req, res) => {
  pgQuery(`UPDATE questions SET (answer,answered_by,answered_at)=(null,null,null)
  WHERE id=$1`, [req.body.id])
  .then(() => res.redirect('back'))
  return
})

app.get('/path', (req, res) => {
  res.redirect('/paths')
})

app.get('/path/create', (req, res) => {
  if (!req.user) return res.redirect('/login')

  author = {}
  author.name = (req.user.display_name) ? req.user.display_name
  : (req.user.username) ? req.user.username : req.user.shortened_id

  res.render('create_path', {
    title: 'Creating a Path of Learning',
    author
  })
})

app.route('/create-path')
.get((req, res) => res.redirect('/path/create'))
.post(express.json(), express.urlencoded({extended: true}), (req, res, next) => {
  if (!req.user) return res.status(401).send('Must be logged in.')

  let {display_name, tags} = req.body
  if (!display_name) return res.status(400).send('Display name required.')
  if (!valid.isLength(display_name, {min: 6, max: 50})) {
    return res.status(400).send('Display name must be between 6-50 characters long.')
  }

  let name = display_name.trim().toLowerCase().split(/\W+/).join('_')
  tags = Array.from(new Set(tags.trim().toLowerCase().split(/\W+/)))

  let path = new Path()

  path.save()
  .then(d => d._id)
  .then(mongo_id => {
    return pgQuery(`INSERT INTO paths (name, display_name, tags, created_by, last_modified_by,
    contributors) VALUES ($1,$2,$3,$4,$4,ARRAY[$4]::uuid[]) RETURNING id;`, [name, display_name,
    tags, req.user.id])
    .then(q => q.rows[0])
    .then(row => {
      var shortened_id = shortenId(row.id)
      console.log('Created path');
      pgQuery(`UPDATE paths SET (shortened_id,mongo_id)=($2,$3) WHERE id=$1;`,
      [row.id, shortened_id, mongo_id.toString()])
      return shortened_id.toString('hex')
    })
  })
  .then(shortened_id => res.redirect(`/path/${name}-${shortened_id}`))
  .catch(e => {
    err(e)
    return res.redirect('back')
  })
  // pgQuery(`SELECT string_agg(tags, ',') as tags FROM paths;`)
})

app.get('/paths', (req, res, next) => {
  var listings = []

  Promise.all([
    pathGroup(req, listings, listPaths, {
      group_name: 'Currently Following',
      require_loggedin: true,
      condition: 'WHERE id = ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])',
      params: (req.user) ? [req.user.id] : undefined,
      empty_message: 'You aren\'t following any paths yet.'
    })
    .catch(e => e),
    pathGroup(req, listings, listPaths, {
      group_name: 'All Paths',
      condition: (req.user) ? `WHERE NOT id =
      ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])` : undefined,
      params: (req.user) ? [req.user.id] : undefined,
      empty_message: 'No paths were found. Did you actually just follow them all?'
    })
    .catch(e => err(e))
  ])
  .then(() => {
    if (!listings) throw 'No paths'
    listings = listings.reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> path_group}}')(group))
    }, '')

    return res.render('list_paths', {
      title: 'Your Paths of Learning',
      listings
    })
  })
  .catch(e => {
    err(e)
    return next('nf')
  })
})

app.get('/paths/:id', (req, res) => {
  res.redirect(`/path/${req.params.id}`)
})

var pathRouter = express.Router()
app.use('/path/:id', (req, res, next) => {
  var {id} = req.params, path
  id = id.split('-')
  id.splice(2)
  if (!id[0] || !id[1]) return next('nf')

  pgQuery(`SELECT id, is_public, name, display_name, created_by, created_at, last_modified_by,
  last_modified_at, image_path, contributors, mongo_id, shortened_id FROM paths
  WHERE name=$1 AND shortened_id=$2;`, [id[0], new Buffer(id[1], 'hex')])
  .then(q => q.rows)
  .then(rows => {
    if (!rows.length) throw 'no path'
    if (rows.length > 1) throw 'multiple paths' // TODO: Redirect to search
    return path = rows[0]
  })
  .then(() => Path.findById(path.mongo_id))
  .then(doc => {
    Object.assign(path, doc.toObject())

    if (path.created_by !== '00000000-0000-0000-0000-000000000000') {
      return pgQuery('SELECT shortened_id, username, display_name FROM users WHERE id=$1;',
      [path.created_by])
      .then(q => q.rows[0])
      .then(path => {
        if (path.author) {
          path.author.shortened_id = path.author.shortened_id.toString('hex')
          path.authorURL = `/user/${path.author.username ? path.author.username :
          'user'}-${path.author.shortened_id}`
          path.author = path.author.display_name || path.author.username ||
          `User ${path.author.shortened_id}`
        } else {
          path.author = 'Deleted User'
          pgQuery(`UPDATE paths SET created_by='00000000-0000-0000-0000-000000000000'
          WHERE id=$1;`, [path.id])
        }
      })
    } else path.author = 'Deleted User'
  })
  .then(() => {
    path.shortened_id = path.shortened_id.toString('hex')
    path.contributors = path.contributors || []
    path.contributors = `${path.contributors.length} ${path.contributors.length !== 1 ? 'People' : 'Person'}`
    path.contentCount = `${path.contentCount} ${path.contentCount !== 1 ? 'Resources' : 'Resource'}`
    path.owned = (req.user.id === path.created_by)
    path.url = `/path/${path.name}-${path.shortened_id}`

    req.data = {path}
    return next()
  })
  .catch(e => {
    err(e)
    return next('nf')
  })
}, pathRouter)

pathRouter.get('/', (req, res, next) => {
  let path = (req.data) ? req.data.path : null
  if (!path) return next('nf')

  return res.render('path', {
    path,
    title: path.display_name
  })
})

pathRouter.get('/edit', (req, res, next) => {
  let path = (req.data) ? req.data.path : null
  if (!path) return next('nf')
  if (req.user.id !== path.created_by) return next('nf')

  path.is_public ? (path.is_public = 'checked') : (path.is_private = 'checked', path.is_public = '')

  return res.render('path_edit', {
    path,
    title: 'Editing ' + path.display_name
  })
})
// app.get('/paths/:pathid/:videoid', (req, res) => {
//   let {pathid, videoid} = req.params;
//   Path.findById(pathid).then(path => {
//     if (!path) return req.renderPage('notfound.hbs', {});
//     let video = path.content.id(videoid);
//     req.renderPage('video-bare.hbs', {
//       translucent_header: true,
//       path, video
//     });
//   }).catch(e => res.send(e));
// });
//
// app.get('/video/:id', (req, res) => {
//   let {id} = req.params;
// });
//
// app.get('/not_found', (req, res) => {
//   req.renderPage('notfound.hbs')
// });
//
// app.get(process.env.EXCADMIN_PAGE, (req, res) => {
//   req.renderPage('admin.hbs', {});
// });
