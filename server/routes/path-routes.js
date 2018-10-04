const express = require('express')
const valid = require('validator')
const hbs = require('hbs')
const uuid = require('uuid/v4')

const {app, errorlog} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const formidable = require('./../middleware/formidable')
const validation = require('./../middleware/validation')
const Path = require('./../db/models/path')
const Resource = require('./../db/models/resource')
const PathStatus = require('./../db/models/pathStatus')
const {listResults, pathGroup, resourceGroup, objectPage, createMaterial
} = require('./web-routes')

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
    errorlog(e)
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
.post(formidable(), createMaterial({type: 'path'}))
// pgQuery(`SELECT string_agg(tags, ',') as tags FROM paths`)

var pathRouter = express.Router()
app.get('/paths/:id', (req, res) => res.redirect(`/path/${req.params.id}`))
app.use('/path/:id', objectPage({
  type: 'path',
  properties: `id, is_public, name, display_name, created_by, created_at,
  last_modified_by, last_modified_at, image_path, shortened_id`,
  condition: 'WHERE name=$1 AND shortened_id=$2',
  model: Path
}), (req, res, next) => {
  req.page.then(path => {
    if (!path) return next('nf')
    path = Object.assign({
      contributors: [],
      contentCount: 0
    }, path, {
      contributors: `${path.contributors.length
      } ${path.contributors.length !== 1 ? 'People' : 'Person'}`,
      owned: (req.user && req.user.id === path.created_by),
      url: `/path/${path.name}-${path.shortened_id}`
    })
    res.locals.path = path
    return next()
  })
  .catch(e => {
    errorlog(e)
    return next('nf')
  })
}, pathRouter)


pathRouter.get('/', (req, res, next) => res.render('path', {
  title: res.locals.path.display_name,
  logged_in: !!req.user
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

pathRouter.delete('/delete', (req, res, next) => {
  if (!req.user) return next('auth')
  var path = res.locals.path
  Promise.all([
    pgQuery(`DELETE FROM paths WHERE id=$1`, [path.id]),
    Path.deleteOne({_id: path.id})
  ])
  .then(q => res.json({
    message: 'Successfully deleted',
    display_name: path.display_name,
    url: path.url
  }))
  .catch(e => (errorlog(e), res.status(500).send('Server Error')))
})

pathRouter.get('/:index', (req, res, next) => {
  var index = parseFloat(req.params.index) - 1
  var {path} = res.locals, {content} = path
  if (index === -1) return res.redirect(path.url + '/1')
  if (isNaN(index) || !(content && content.length > index && index >= 0)) {
    return res.redirect(path.url)
  }

  var promise = Promise.resolve()
  if (req.user) {
    var statusQuery = {user: req.user.id, path: path.id}
    promise = promise.then(() => PathStatus.find(statusQuery))
    .then(docs => {
      if (docs.length === 0) return new PathStatus(statusQuery).save()
      else return docs[0]
    })
  }
  promise.then(doc => {
    if (doc) var current_status = doc.progress[0]
    var current_resource = path.content[index]
    if (!content[index]) return res.redirect(path.url)
    return res.render('inpath', {
      hide_header: true,
      hide_footer: true,
      title: path.display_name, path, index,
      resource_url: content[index].url
    })
  })
})
