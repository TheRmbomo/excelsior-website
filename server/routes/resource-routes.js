const path = require('path')
const fs = require('fs')
const events = require('events')
const express = require('express')
const valid = require('validator')
const hbs = require('hbs')
const uuid = require('uuid/v4')

const {app, errorlog} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const formidable = require('./../middleware/formidable')
const validation = require('./../middleware/validation')
const Resource = require('./../db/models/resource')
const Video = require('./../db/models/video')
const Article = require('./../db/models/article')
const models = {
  Resource, Video, Article,

  resource: Resource,
  video: Video,
  article: Article
}
const {listResults, pathGroup, resourceGroup, objectPage, createMaterial
} = require('./web-routes')

app.get('/content', (req, res, next) => {
  Promise.all([
    resourceGroup(req, listResults, {
      group_name: 'All Content',
      empty_message: 'No content was found.'
    })
  ])
  .then(listings => {
    listings = listings.filter(i => !!i).reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> results_group}}')(group))
    }, '')

    return res.render('list_results', {
      title: 'Content',
      type: 'content',
      create: 'Create content',
      listings
    })
  })
  .catch(e => {
    errorlog(e)
    return next('nf')
  })
})

app.route('/create-content')
.all((req, res, next) => {
  if (!req.user) return next('auth')
  next()
})
.get((req, res) => {
  var author = {}
  author.name = req.user.display_name || req.user.username

  res.render('create_object', {
    title: 'Creating Content',
    header: 'Creating Content',
    type: 'content',
    id: uuid(),
    author,
    source: true,
    create: 'Create Content'
  })
})
.post(formidable(), createMaterial({type: 'resource'}))

var resourceRouter = express.Router()
app.use('/content/:id', objectPage({
  type: 'resource',
  properties: `id, is_public, name, display_name, created_by, created_at, last_modified_by,
  last_modified_at, image_path, shortened_id`,
  condition: 'WHERE name=$1 AND shortened_id=$2',
  model: Resource
}), (req, res, next) => {
  req.page.then(resource => {
    Object.assign(resource, {
      owned: (req.user && req.user.id === resource.created_by),
      url: `/content/${resource.name}-${resource.shortened_id}`
    })

    if (!resource) return next('nf')
    res.locals.resource = resource
    return next()
  })
  .catch(e => {
    errorlog(e)
    next('nf')
  })
}, resourceRouter)

resourceRouter.get('/', (req, res) => res.render('resource', {
  title: res.locals.resource.display_name,
  logged_in: !!req.user
}))

resourceRouter.get('/edit', (req, res, next) => {
  if (!req.user) return next('auth')

  var resource = res.locals.resource
  console.log(resource);
  if (resource.created_by !== req.user.id) return res.redirect(`/content/${resource.url}`)

  resource.is_public ? (resource.is_public = 'checked') :
  (resource.is_private = 'checked', resource.is_public = '')

  resource.source_type === 'embed' ? (
    resource.is_embed = 'checked'
  ) : resource.is_original = 'checked'
  // switch (resource.__t) {
  //   case 'Video': resource.is_video = true
  //   break
  //   case 'Article': resource.is_article = true
  //   break
  // }

  return new Promise(resolve => {
    // TODO: When adding more resource models, adjust
    // if (resource.__t === 'Video' || resource.source_type) return resolve()
    // if (!resource.source) {
    //   resource.source = `/articles/${resource.name}-${resource.shortened_id}.html`
    // }
    // fs.readFile(path.join(__dirname, '../../public', resource.source), 'utf8',
    // (err, data) => {
    //   if (err) return resolve()
    //   resolve(data)
    // })
    resolve()
  })
  .then(text => {
    return res.render('settings', {
      header: 'Content',
      type: 'resource',
      page: 'resource_edit',
      title: 'Editing Content'
    })
  })
})

resourceRouter.delete('/delete', (req, res, next) => {
  if (!req.user) return next('auth')
  var resource = res.locals.resource
  Promise.all([
    pgQuery(`DELETE FROM resources WHERE id=$1`, [resource.id]),
    Resource.deleteOne({_id: resource.id})
  ])
  .then(q => res.json({
    message: 'Successfully deleted',
    display_name: resource.display_name,
    url: resource.url
  }))
  .catch(e => (errorlog(e), res.status(500).send('Server Error')))
})

resourceRouter.get('/embed', (req, res, next) => {
  var resource = res.locals.resource

  res.render('resource', {
    hide_header: true,
    hide_footer: true,
    embed: true,
    title: resource.display_name,
    logged_in: !!req.user
  })
})
