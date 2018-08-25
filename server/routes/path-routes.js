const events = require('events')
const express = require('express')
const valid = require('validator')
const hbs = require('hbs')
const uuid = require('uuid/v4')

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const Path = require('./../db/models/path')
const {listResults, pathGroup, resourceGroup, objectPage} = require('./web-routes')

var err = e => console.log(Error(e))

app.get('/path', (req, res) => res.redirect('/paths'))
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
      empty_message: 'No paths were found. Did you actually just follow them all?'
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

app.route('/create-path')
.all((req, res, next) => {
  if (!req.user) return next('auth')
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
  var {id, display_name, tags, description} = req.body
  if (!display_name) return res.status(400).send({display_name: 'required'})
  if (!id) return res.status(400).send({id: 'required'})
  var uuid_regex = `^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-${''
  }[0-9A-F]{12}$`
  if (!valid.isUUID(id) ||
  !valid.matches(id, new RegExp(uuid_regex, 'i'))) {
    return res.status(400).send({id: 'invalid'})
  }

  try {
    var name = req.sanitize('name', display_name)
    display_name = req.sanitize('display_name', display_name)
    tags = req.sanitize('tags', tags)
    description = req.sanitize('description', description)
  } catch (e) {return res.status(400).send(e)}

  pgQuery(`SELECT NULL FROM paths WHERE id=$1`, [id])
  .then(q => q.rows[0])
  .then(path => {
    if (path) id = null
    var sql_properties = ['name', 'display_name', 'tags', 'created_by',
    'last_modified_by'],
    sql_places = ['$1','$2','$3','$4','$4'],
    params = [name, display_name, tags, req.user.id]
    if (id) {
      sql_properties.push('id')
      sql_places.push(`$${params.push(id)}`)
    }
    return pgQuery(`INSERT INTO paths (${sql_properties.toString()})
    VALUES (${sql_places.toString()}) RETURNING id`, params)
  })
  .then(q => q.rows[0])
  .then(row => {
    var shortened_id = shortenId(row.id)
    console.log('Created path');
    pgQuery(`UPDATE paths SET shortened_id=$2 WHERE id=$1`, [row.id, shortened_id])
    var path = new Path()
    path._id = row.id
    path.description = description
    return path.save().then(() => shortened_id.toString('hex'))
  })
  .then(shortened_id => res.redirect(`/path/${name}-${shortened_id}`))
  .catch(e => {
    err(e)
    return res.redirect('back')
  })
  // pgQuery(`SELECT string_agg(tags, ',') as tags FROM paths`)
})

var pathRouter = express.Router()
app.get('/paths/:id', (req, res) => res.redirect(`/path/${req.params.id}`))
app.use('/path/:id', (req, res, next) => objectPage({
  type: 'path',
  properties: `id, is_public, name, display_name, created_by, created_at,
  last_modified_by, last_modified_at, image_path, shortened_id`,
  condition: 'WHERE name=$1 AND shortened_id=$2',
  model: Path
})(req, res, next)
.then(path => {
  path = Object.assign({
    contributors: [],
    contentCount: 0
  }, path, {
    contributors: `${path.contributors.length
    } ${path.contributors.length !== 1 ? 'People' : 'Person'}`,
    contentCount: `${path.contentCount
    } ${path.contentCount !== 1 ? 'Resources' : 'Resource'}`,
    owned: (req.user && req.user.id === path.created_by),
    url: `/path/${path.name}-${path.shortened_id}`
  })
  if (!path) return next('nf')
  res.locals.path = path
  return next()
})
.catch(e => {
  err(e)
  return next('nf')
}), pathRouter)

pathRouter.get('/', (req, res, next) => res.render('path', {
  title: res.locals.path.display_name
}))

pathRouter.get('/edit', (req, res, next) => {
  if (!req.user) return next('auth')

  var path = res.locals.path
  if (path.created_by !== req.user.id) return res.redirect(`/path/${path.url}`)

  path.is_public ? (path.is_public = 'checked') :
  (path.is_private = 'checked', path.is_public = '')

  return res.render('settings', {
    header: 'Path',
    type: 'path',
    page: 'path_edit',
    title: 'Editing Path'
  })
})

pathRouter.get('/creator', (req, res, next) => {
  if (!req.user) return next('auth')

  var path = res.locals.path
  if (path.created_by !== req.user.id) return res.redirect(`/path/${path.url}`)

  return res.render('creator', {
    hide_header: true,
    hide_footer: true,
    title: 'Paving A Path',
    path
  })
})
