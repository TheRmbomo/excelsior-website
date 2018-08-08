const events = require('events')
const express = require('express')
const valid = require('validator')
const hbs = require('hbs')
const uuid = require('uuid/v4')

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const Path = require('./../db/models/path')
const Resource = require('./../db/models/resource')

var err = e => console.log(Error(e)),
listResults = (req, rows, opt) => rows.reduce((promise, res) => promise.then(text => {
  if (!res.name || !res.shortened_id) return text
  if (opt.type === 'path') {
    res.following = (req.user && req.user.paths_following.indexOf(res.id) !== -1)
  }
  res.last_modified_at = req.format_date(res.last_modified_at)
  res.url = `/${opt.type}/${res.name}-${res.shortened_id.toString('hex')}`

  if (res.created_by !== '00000000-0000-0000-0000-000000000000') {
    return pgQuery(`SELECT id, display_name, username, shortened_id FROM users
    WHERE id=$1`, [res.created_by])
    .then(q => {
      if (q.rows[0]) return q.rows[0]

      res.author = new hbs.SafeString('<span style="font-size: 0.8em;">[Deleted User]</span><br>')
      pgQuery(`UPDATE ${opt.type}s SET created_by='00000000-0000-0000-0000-000000000000'
      WHERE id=$1`, [res.id])
      .catch(e => e)
      throw ''
    })
    .then(user => {
      res.author = user.display_name || user.username
      if (res.author.length > 16) res.author = res.author.slice(0,16).trim() + '...'
      res.owned = req.user ? (req.user.id === user.id) : false
      res.author = new hbs.SafeString('<span style="white-space: nowrap;">By: '
      + hbs.Utils.escapeExpression(res.author) + '</span><br>')
      return text
    })
    .catch(e => text)
  } else {
    res.author = new hbs.SafeString('<span style="font-size: 0.8em;"><em>[By Deleted User]</em></span><br>')
    return text
  }
})
.then(text => opt.model.findById(res.mongo_id).then(doc => {
  if (!doc) return text
  var description = doc.description || new hbs.SafeString('<em style="font-size: 0.8em">[No Description]</em>')
  if (description.length > 85) description = description.slice(0, 85).trim() + '...'
  res.description = description
  if (opt.type === 'path') res.second_row = true
  return text +  hbs.compile(`{{> result_listing}}`)(res)
})), Promise.resolve(''))
.catch(e => err(e)),
resultsGroup = (req, list, opt) => new Promise((resolve, reject) => {
  // Setting defaults
  opt = Object.assign({
    properties: `id, created_by, shortened_id, name, display_name, image_path, last_modified_at,
    mongo_id, rating`,
    condition: '',
    order: 'ORDER BY last_modified_at DESC',
    params: [],
    group_name: 'Results',
    empty_message: 'No results were found.',
    visible: true
  }, opt)
  if (!req) return reject('Request required')
  if (!opt.type) return reject('Type required')
  if (!opt.model) return reject('Model required')
  if (!opt.visible) return reject('Not visible')
  return pgQuery(`SELECT ${opt.properties} FROM ${opt.type}s ${opt.condition} ${opt.order}`, opt.params)
  .then(q => q.rows)
  .then(rows => resolve(rows))
  .catch(e => reject(e))
})
.then(rows => rows ? list(req, rows, opt) : null)
.then(results => {
  results = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${
    results ? results : `<div class="tr">
    <div class="td center round dark background padding">${opt.empty_message}</div>
    </div>`
  }</div>`)
  return {group_name: opt.group_name, results}
})
.catch(e => {
  err(e)
  return null
}),
pathGroup = (req, list, opt) => resultsGroup(req, list, Object.assign(opt, {
  type: 'path',
  model: Path
})),
resourceGroup = (req, list, opt) => resultsGroup(req, list, Object.assign(opt, {
  type: 'resource',
  model: Resource
}))

module.exports.listResults = listResults
module.exports.pathGroup = pathGroup
module.exports.resourceGroup = resourceGroup

app.get('/', (req, res) => {
  // pgQuery('UPDATE users SET emails=array_append(emails,$2) WHERE id=$1', ['def765af-4fb5-4477-9e21-0f7d24ec29c2','a@c.com'])
  res.render('index', {
    title: 'Excelsior, the education and curation platform that fits you',
    message: req.user ? '' : 'Welcome to Excelsior'
  })
})

app.get('/questions', (req, res) => {
  pgQuery(`SELECT id, first_name, last_name, question, asked_at,
  answer, answered_by, answered_at
  FROM questions ORDER BY asked_at DESC`)
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
  WHERE id=$1`, [req.body.id, req.body.answer, req.body.answered_by])
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

app.route('/create-path')
.all((req, res, next) => {
  if (!req.user) return res.status(401).redirect('/login')
  next()
})
.get((req, res) => {
  var author = {}
  author.name = req.user.display_name || req.user.username

  res.render('create_object', {
    title: 'Creating a Path of Learning',
    header: 'Creating a Path of Learning',
    type: 'path',
    id: uuid(),
    author,
    create: 'Create Path'
  })
})
.post(express.json(), express.urlencoded({extended: true}), (req, res, next) => {
  var {id, display_name, tags} = req.body
  if (!display_name) return res.status(400).send({display_name: 'required'})
  if (!id) return res.status(400).send({id: 'required'})
  if (!valid.isUUID(id) ||
  !valid.matches(id, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
    return res.status(400).send({id: 'invalid'})
  }

  try {
    var name = req.sanitize('name', display_name)
    display_name = req.sanitize('display_name', display_name)
    tags = req.sanitize('tags', tags)
  } catch (e) {return res.status(400).send(e)}

  pgQuery(`SELECT NULL FROM paths WHERE id=$1`, [id])
  .then(q => q.rows[0])
  .then(path => {
    if (path) id = null
    return (new Path()).save()
  })
  .then(d => d._id)
  .then(mongo_id => {
    var insert_id = id ? ['id, ','$5,'] : ['',''],
    params = [name, display_name, tags, req.user.id]
    if (id) params.push(id)

    return pgQuery(`INSERT INTO paths (${insert_id[0]}name, display_name, tags, created_by,
    last_modified_by, contributors) VALUES (${insert_id[1]}$1,$2,$3,$4,$4,ARRAY[$4]::uuid[])
    RETURNING id`, params)
    .then(q => q.rows[0])
    .then(row => {
      var shortened_id = shortenId(row.id)
      console.log('Created path');
      pgQuery(`UPDATE paths SET (shortened_id,mongo_id)=($2,$3) WHERE id=$1`,
      [row.id, shortened_id, mongo_id.toString()])
      return shortened_id.toString('hex')
    })
  })
  .then(shortened_id => res.redirect(`/path/${name}-${shortened_id}`))
  .catch(e => {
    err(e)
    return res.redirect('back')
  })
  // pgQuery(`SELECT string_agg(tags, ',') as tags FROM paths`)
})

app.get('/paths', (req, res, next) => {
  Promise.all([
    pathGroup(req, listResults, {
      group_name: 'Currently Following',
      condition: 'WHERE id = ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])',
      params: req.user ? [req.user.id] : undefined,
      empty_message: 'You aren\'t following any paths yet.',
      visible: !!req.user
    }),
    pathGroup(req, listResults, {
      group_name: 'All Paths',
      condition: req.user ? `WHERE NOT id =
      ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])` : undefined,
      params: req.user ? [req.user.id] : undefined,
      empty_message: 'No paths were found. Did you actually just follow them all?',
      visible: true
    })
  ])
  .then(listings => {
    listings = listings.filter(i => !!i).reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> results_group}}')(group))
    }, '')

    return res.render('list_results', {
      title: 'Your Paths of Learning',
      type: 'path',
      create: 'Create a Path of Learning',
      listings,
      js: 'list_paths'
    })
  })
  .catch(e => {
    err(e)
    return next('nf')
  })
})

var pathRouter = express.Router()
app.get('/paths/:id', (req, res) => res.redirect(`/path/${req.params.id}`))
app.use('/path/:id', (req, res, next) => {
  var {id} = req.params, path
  id = id.split('-')
  id.splice(2)
  if (!id[0] || !id[1]) return next('nf')

  pgQuery(`SELECT id, is_public, name, display_name, created_by, created_at, last_modified_by,
  last_modified_at, image_path, contributors, mongo_id, shortened_id FROM paths
  WHERE name=$1 AND shortened_id=$2`, [id[0], new Buffer(id[1], 'hex')])
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
      .then(user => {
        if (user) {
          user.shortened_id = user.shortened_id.toString('hex')
          path.authorURL = `/user/${user.username}-${user.shortened_id}`
          path.author = user.display_name || user.username
        } else {
          path.author = 'Deleted User'
          pgQuery(`UPDATE paths SET created_by='00000000-0000-0000-0000-000000000000'
          WHERE id=$1`, [path.id])
        }
      })
    } else path.author = 'Deleted User'
  })
  .then(() => {
    path.shortened_id = path.shortened_id.toString('hex')
    path = Object.assign({
      contributors: [],
      contentCount: 0
    }, path, {
      contributors: `${path.contributors.length} ${path.contributors.length !== 1 ? 'People' : 'Person'}`,
      contentCount: `${path.contentCount} ${path.contentCount !== 1 ? 'Resources' : 'Resource'}`,
      owned: (req.user.id === path.created_by),
      url: `/path/${path.name}-${path.shortened_id}`
    })
    if (!path) return next('nf')
    res.locals.path = path
    return next()
  })
  .catch(e => {
    err(e)
    return next('nf')
  })
}, pathRouter)

pathRouter.get('/', (req, res, next) => {
  var path = res.locals.path

  return res.render('path', {
    title: path.display_name
  })
})

pathRouter.get('/edit', (req, res, next) => {
  if (!req.user) return res.redirect('/login')
  var path = res.locals.path
  if (req.user.id !== path.created_by) return res.redirect(`/path/${path.url}`)

  path.is_public ? (path.is_public = 'checked') : (path.is_private = 'checked', path.is_public = '')

  return res.render('settings', {
    type: 'path',
    page: 'path_edit',
    title: 'Editing Path'
  })
})

app.get('/resources', (req, res, next) => {
  Promise.all([
    resourceGroup(req, listResults, {
    })
  ])
  .then(listings => {
    listings = listings.filter(i => !!i).reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> results_group}}')(group))
    }, '')

    return res.render('list_results', {
      title: 'Resources',
      type: 'resource',
      create: 'Create a Resource',
      listings,
      js: 'list_resources'
    })
  })
  .catch(e => {
    err(e)
    return next('nf')
  })
})

app.route('/create-resource')
.all((req, res, next) => {
  if (!req.user) return res.status(401).redirect('/login')
  next()
})
.get((req, res) => {
  var author = {}
  author.name = req.user.display_name || req.user.username

  res.render('create_object', {
    title: 'Creating a Resource',
    header: 'Creating a Resource',
    type: 'resource',
    id: uuid(),
    author,
    create: 'Create Resource'
  })
})
.post(express.json(), express.urlencoded({extended: true}), (req, res) => {
  var {id, display_name, tags} = req.body
  if (!display_name) return res.status(400).send({display_name: 'required'})
  if (!id) return res.status(400).send({id: 'required'})
  if (!valid.isUUID(id) ||
  !valid.matches(id, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
    return res.status(400).send({id: 'invalid'})
  }

  try {
    var name = req.sanitize('name', display_name)
    display_name = req.sanitize('display_name', display_name)
    tags = req.sanitize('tags', tags)
  } catch (e) {return res.status(400).send(e)}

  pgQuery(`SELECT NULL FROM resources WHERE id=$1`, [id])
  .then(q => q.rows[0])
  .then(resource => {
    if (resource) id = null
    return (new Resource()).save()
  })
  .then(d => d._id)
  .then(mongo_id => {
    var insert_id = id ? ['id, ','$5,'] : ['',''],
    params = [name, display_name, tags, req.user.id]
    if (id) params.push(id)

    return pgQuery(`INSERT INTO resources (${insert_id[0]}name, display_name, tags, created_by,
    last_modified_by) VALUES (${insert_id[1]}$1,$2,$3,$4,$4)
    RETURNING id`, params)
    .then(q => q.rows[0])
    .then(row => {
      var shortened_id = shortenId(row.id)
      console.log('Created resource')
      pgQuery(`UPDATE resources SET (shortened_id,mongo_id)=($2,$3) WHERE id=$1`,
      [row.id, shortened_id, mongo_id.toString()])
      return shortened_id.toString('hex')
    })
  })
  .then(shortened_id => res.redirect(`/resource/${name}-${shortened_id}`))
  .catch(e => {
    err(e)
    return res.redirect('back')
  })
})

app.get('/resources/:id', (req, res) => res.redirect(`/resource/${req.params.id}`))
var resourceRouter = express.Router()
app.use('/resource/:id', (req, res, next) => {
  var {id} = req.params, resource
  id = id.split('-')
  id.splice(2)
  if (!id[0] || !id[1]) return next('nf')

  pgQuery(`SELECT id, is_public, name, display_name, created_by, created_at, last_modified_by,
  last_modified_at, image_path, mongo_id, shortened_id FROM resources
  WHERE name=$1 AND shortened_id=$2`, [id[0], new Buffer(id[1], 'hex')])
  .then(q => q.rows)
  .then(rows => {
    if (!rows.length) throw 'no resource'
    if (rows.length > 1) throw 'multiple resources' // TODO: Redirect to search
    return resource = rows[0]
  })
  .then(() => Resource.findById(resource.mongo_id))
  .then(doc => {
    Object.assign(resource, doc.toObject())
    if (resource.created_by !== '00000000-0000-0000-0000-000000000000') {
      return pgQuery('SELECT shortened_id, username, display_name FROM users WHERE id=$1;',
      [resource.created_by])
      .then(q => q.rows[0])
      .then(user => {
        if (user) {
          user.shortened_id = user.shortened_id.toString('hex')
          resource.authorURL = `/user/${user.username}-${user.shortened_id}`
          resource.author = user.display_name || user.username
        } else {
          resource.author = 'Deleted User'
          pgQuery(`UPDATE resources SET created_by='00000000-0000-0000-0000-000000000000'
          WHERE id=$1`, [resource.id])
        }
      })
    } else resource.author = 'Deleted User'
  })
  .then(() => {
    resource.shortened_id = resource.shortened_id.toString('hex')
    Object.assign(resource, {
      owned: (req.user.id === resource.created_by),
      url: `/resource/${resource.name}-${resource.shortened_id}`
    })

    if (!resource) return next('nf')
    res.locals.resource = resource
    return next()
  })
  .catch(e => {
    err(e)
    return next('nf')
  })
}, resourceRouter)

resourceRouter.get('/', (req, res) => {
  var resource = res.locals.resource

  res.render('resource', {
    title: resource.display_name
  })
})

resourceRouter.get('/edit', (req, res) => {
  var resource = res.locals.resource

  return res.render('settings', {
    type: 'resource',
    page: 'resource_edit',
    title: 'Editing Resource'
  })
})
