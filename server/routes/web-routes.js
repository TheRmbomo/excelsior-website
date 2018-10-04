const path = require('path')
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
const properties = require('./../json/model_properties.json')
const User = require('./../db/models/user')
const Path = require('./../db/models/path')
const Resource = require('./../db/models/resource')
const models = {
  User, Path, Resource,
  user: User,
  path: Path,
  resource: Resource
}

var listResults = (req, rows, opt) => rows.reduce((promise, res) => promise.then(text => {
  if (!res.name || !res.shortened_id) return text
  if (opt.type === 'path') {
    res.following = (req.user && req.user.paths_following.indexOf(res.id) !== -1)
  }
  res.shortened_id = res.shortened_id.toString('hex')
  res.last_modified_at = req.format_date(res.last_modified_at)
  res.url = `/${opt.type}/${res.name}-${res.shortened_id}`.replace('resource', 'content')
  var deletedUser = new hbs.SafeString(`<span style="font-size: 0.8em;">${
    '[Deleted User]'
  }</span><br>`)

  if (res.created_by !== '00000000-0000-0000-0000-000000000000') {
    return pgQuery(`SELECT id, display_name, username, shortened_id FROM users
      WHERE id=$1`, [res.created_by]
    ).then(q => q.rows[0])
    .then(user => {
      if (user) return user
      // No user
      res.author = deletedUser
      pgQuery(`UPDATE ${opt.type}s SET created_by='00000000-0000-0000-0000-000000000000'
        WHERE id=$1`, [res.id]
      ).catch(e => errorlog(e))
      throw ''
    })
    .then(user => {
      res.author = user.display_name
      if (res.author.length > 16) res.author = res.author.slice(0,16).trim() + '...'
      res.owned = req.user ? (req.user.id === user.id) : false
      res.author = new hbs.SafeString(`<span style="white-space: nowrap;">By: <a href="${
        `/user/${user.username}-${user.shortened_id.toString('hex')}`
      }">` + hbs.Utils.escapeExpression(res.author) + '</a></span><br>')
      return text
    })
    .catch(e => (errorlog(e), text))
  }
  else {
    res.author = deletedUser
    return text
  }
})
.then(text => opt.model.findById(res.id).then(doc => {
  if (!doc) {
    pgQuery(`DELETE FROM ${opt.type}s WHERE id=$1`, [res.id])
    return text
  }
  var description = doc.description || new hbs.SafeString(`<em style="font-size: 0.8em">${
    '[No Description]'
  }</em>`)
  if (description.length > 85) description = description.slice(0, 85).trim() + '...'
  res.description = description
  if (opt.type === 'path') res.second_row = true
  return text +  hbs.compile(`{{> result_listing}}`)(res)
})), Promise.resolve(''))
.catch(e => errorlog(e)),
resultsGroup = (req, list, opt) => new Promise((resolve, reject) => {
  // Setting defaults
  opt = Object.assign({
    properties: `id, created_by, shortened_id, name, display_name, image_path,
    last_modified_at, rating`,
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
  return pgQuery(`SELECT ${opt.properties} FROM ${opt.type}s ${opt.condition} ${opt.order}`,
    opt.params
  ).then(q => q.rows)
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
.catch(e => null),
pathGroup = (req, list, opt) => resultsGroup(req, list, Object.assign(opt, {
  type: 'path',
  model: Path
})),
resourceGroup = (req, list, opt) => resultsGroup(req, list, Object.assign(opt, {
  type: 'resource',
  model: Resource
})),
objectPage = opt => (req, res, next) => {
  opt = Object.assign({
    type: '',
    properties: '',
    condition: '',
    model: ''
  }, opt)
  var {id} = req.params
  id = id.split('-').slice(0,2)
  if (!(id[0] && id[1])) return next('nf')

  req.page = pgQuery(`SELECT ${opt.properties} FROM ${opt.type}s ${opt.condition}`,
    [id[0], Buffer.from(id[1], 'hex')]
  ).then(q => q.rows)
  .then(rows => {
    if (!rows.length) throw 'No results'
    if (rows.length > 1) throw 'Multiple results' // TODO: Redirect to search
    return rows[0]
  })
  .then(res => opt.model.findById(res.id)
  .then(doc => {
    if (!doc) {
      pgQuery(`DELETE FROM ${opt.type}s WHERE id=$1`, [res.id])
      throw 'No result in Mongo'
    }
    return Object.assign(res, doc.toObject())
  }))
  .then(res => {
    res.shortened_id = res.shortened_id.toString('hex')
    ;['_id', '__v'].map(key => delete res[key])
    delete res._id
    if (!res.created_by) return res

    if (res.created_by !== '00000000-0000-0000-0000-000000000000') {
      return pgQuery('SELECT shortened_id, username, display_name FROM users WHERE id=$1;',
        [res.created_by]
      ).then(q => q.rows[0])
      .then(user => {
        if (user) {
          user.shortened_id = user.shortened_id.toString('hex')
          res.authorURL = `/user/${user.username}-${user.shortened_id}`
          res.author = user.display_name
        }
        else {
          res.author = 'Deleted User'
          pgQuery(`UPDATE paths SET created_by='00000000-0000-0000-0000-000000000000'
            WHERE id=$1`, [res.id]
          )
          .catch(errorlog)
        }
        return res
      })
    } else res.author = 'Deleted User'
    return res
  })
  .catch(e => null)
  return next()
},
createMaterial = opt => (req, res, next) => {
try {
  if (!req.user) return next('auth')
  if (!req.body) return (errorlog(Error('req.body is missing')), next('err'))
  opt = Object.assign(opt, {mongo: {}, data: {}}) || {mongo: {}, data: {}}
  try {
    if (!req.body.id) throw 'Required: id'
    if (!req.body.display_name) throw 'Required: display_name'
    if (!validation.uuid(req.body.id)) throw 'Invalid: id'
  }
  catch (e) {return res.status(400).send(e)}
  for (let keys = properties[opt.type].create, i = keys.length-1, args; i >= 0; i--) {
    let key = keys[i]
    if (key.length === 1) args = [key[0], req.body[key[0]]]
    else if (key.length === 3) args = [key[1], req.body[key[2]]]
    else {errorlog(Error('Invalid number arguments')); continue}
    opt.data[key[0]] = validation.metadata(args, err => {
      if (err) return res.status(400).send(err)
    })
    if (res.headersSent) return
  }

  pgQuery(`SELECT NULL FROM ${opt.type}s WHERE id=$1`, [req.body.id]).then(q => q.rows[0])
  .then(row => {
    if (row) throw 'Repeated request'
    if (req.body.create === 'false') return {id: req.body.id}
    var data = opt.data

    return pgQuery(`INSERT INTO ${opt.type}s (id, name, display_name, tags, created_by,
      last_modified_by) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
      [req.body.id, data.name, data.display_name, data.tags, req.user.id]
    ).then(q => q.rows[0])
  })
  .then(row => {
    var shortened_id = shortenId(row.id)
    properties.mongo[opt.type].public.map(key => opt.mongo[key] = opt.data[key])
    Object.assign(opt.mongo, {_id: row.id})
    var doc = new models[opt.type](opt.mongo)
    if (req.body.create === 'false') {
      res.write(Buffer.from(JSON.stringify(doc, undefined, 2)))
      return res.end()
    }
    opt.type2 = properties[opt.type]._redirect || opt.type
    console.log(1, opt.type2);
    return doc.save()
    .then(doc => pgQuery(`UPDATE ${opt.type}s SET shortened_id=$2 WHERE id=$1`,
      [row.id, shortened_id])
    )
    .then(() => res.redirect(`/${opt.type2}/${opt.data.name}-${shortened_id.toString('hex')}`))
  }, e => {res.write(e); throw e})
  .catch(e => {
    if (e) errorlog(e)
    return res.status(500).end('Server error')
  })
}
catch (e) {return (res.status(500).send('Server error'), errorlog(e))}
}

module.exports.listResults = listResults
module.exports.pathGroup = pathGroup
module.exports.resourceGroup = resourceGroup
module.exports.objectPage = objectPage
module.exports.createMaterial = createMaterial

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Axys Mundi, the intersection of our paths.',
    message: req.user ? '' : 'Welcome to Axys Mundi'
  })
})

app.post('/upload-file', formidable({
  outputPath: path.join(__dirname, '../public/')
}), (req, res, next) => {
  console.log('app', req.form)
})

app.post('/inbound-axys', formidable(), (req, res) => {
  console.log('mail', req.body);
  res.send(req.body)
})
