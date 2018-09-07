const path = require('path')
const fs = require('fs')
const events = require('events')
const express = require('express')
const valid = require('validator')
const hbs = require('hbs')
const uuid = require('uuid/v4')

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const Resource = require('./../db/models/resource')
const Video = require('./../db/models/video')
const Article = require('./../db/models/article')
const models = {
  Resource, Video, Article,

  resource: Resource,
  video: Video,
  article: Article
}
const {listResults, pathGroup, resourceGroup, objectPage} = require('./web-routes')

var err = e => console.log(Error(e))

app.get('/resource', (req, res) => res.redirect('/resources'))
app.get('/resources', (req, res, next) => {
  Promise.all([
    resourceGroup(req, listResults, {
      group_name: 'All Resources',
      empty_message: 'No resources were found.'
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
  if (!req.user) return next('auth')
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
    resource_types: [{value: 'select', text: 'Choose an option'},{value: 'video', text: 'Video'},
    {value: 'article', text: 'Article'}],
    create: 'Create Resource'
  })
})
.post(express.json(), express.urlencoded({extended: true}), (req, res) => {
  var {id, type} = req.body
  if (!req.body.display_name) return res.status(400).send({display_name: 'required'})
  if (!id) return res.status(400).send({id: 'required'})
  if (!valid.isUUID(id) ||
  !valid.matches(id, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
    return res.status(400).send({id: 'invalid'})
  }
  if(!valid.isIn(req.body.type, ['video','article'])) return res.status(400).send({type: 'invalid'})

  try {
    var name = req.sanitize('name', req.body.display_name),
    display_name = req.sanitize('display_name', req.body.display_name),
    tags = req.sanitize('tags', req.body.tags),
    description = req.sanitize('description', req.body.description),
    source = req.sanitize('source', req.body.source)
    if (type === 'select') throw {type: 'required'}
  } catch (e) {return res.status(400).send(e)}

  pgQuery(`SELECT NULL FROM resources WHERE id=$1`, [id])
  .then(q => q.rows[0])
  .then(resource => {
    if (resource) throw 'Repeated request'

    var insert_id = id ? ['id, ','$5,'] : ['',''],
    params = [name, display_name, tags, req.user.id]
    if (id) params.push(id)

    return pgQuery(`INSERT INTO resources (${insert_id[0]}name, display_name, tags, created_by,
    last_modified_by) VALUES (${insert_id[1]}$1,$2,$3,$4,$4)
    RETURNING id`, params)
  })
  .then(q => q.rows[0])
  .then(row => {
    var shortened_id = shortenId(row.id)
    console.log('Created resource')
    var resource = new models[type]({
      _id: row.id, description, source
    })
    return resource.save()
    .then(doc => pgQuery(`UPDATE resources SET shortened_id=$2 WHERE id=$1`, [row.id, shortened_id]))
    .then(() => res.redirect(`/resource/${name}-${shortened_id.toString('hex')}`))
  })
  .catch(e => {
    err(e)
    return res.redirect('back')
  })
})

var resourceRouter = express.Router()
app.get('/resources/:id', (req, res) => res.redirect(`/resource/${req.params.id}`))
app.use('/resource/:id', (req, res, next) => objectPage({
  type: 'resource',
  properties: `id, is_public, name, display_name, created_by, created_at, last_modified_by,
  last_modified_at, image_path, shortened_id`,
  condition: 'WHERE name=$1 AND shortened_id=$2',
  model: Resource
})(req, res, next)
.then(resource => {
  Object.assign(resource, {
    owned: (req.user && req.user.id === resource.created_by),
    url: `/resource/${resource.name}-${resource.shortened_id}`
  })

  if (!resource) return next('nf')
  res.locals.resource = resource
  return next()
})
.catch(e => {
  err(e)
  return next('nf')
}), resourceRouter)

resourceRouter.get('/', (req, res) => {
  var resource = res.locals.resource

  res.render('resource', {
    title: resource.display_name
  })
})

resourceRouter.get('/edit', (req, res, next) => {
  if (!req.user) return next('auth')

  var resource = res.locals.resource
  if (resource.created_by !== req.user.id) return res.redirect(`/resource/${resource.url}`)

  resource.is_public ? (resource.is_public = 'checked') :
  (resource.is_private = 'checked', resource.is_public = '')

  resource.source_type ? resource.is_embed = 'checked' : resource.is_original = 'checked'
  switch (resource.__t) {
    case 'Video': resource.is_video = true
    break
    case 'Article': resource.is_article = true
    break
  }

  return new Promise(resolve => {
    // TODO: When adding more resource models, adjust
    if (resource.__t === 'Video' || resource.source_type) return resolve()
    if (!resource.source) {
      resource.source = `/articles/${resource.name}-${resource.shortened_id}.html`
    }
    fs.readFile(path.join(__dirname, '../../public', resource.source), 'utf8', (err, data) => {
      if (err) return resolve()
      resolve(data)
    })
  })
  .then(text => {
    return res.render('settings', {
      header: 'Resource',
      type: 'resource',
      page: 'resource_edit',
      title: 'Editing Resource',
      text
    })
  })
})

resourceRouter.get('/embed', (req, res, next) => {
  var resource = res.locals.resource

  res.render('resource', {
    hide_header: true,
    hide_footer: true,
    embed: true,
    title: resource.display_name
  })
})
