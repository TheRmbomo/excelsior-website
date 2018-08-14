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
      res.author = user.display_name
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
.then(text => opt.model.findById(res.id).then(doc => {
  if (!doc) {
    pgQuery(`DELETE FROM ${opt.type}s WHERE id=$1`, [res.id])
    return text
  }
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
    rating`,
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
})),
objectPage = opt => {
  opt = Object.assign({
    type: '',
    properties: '',
    condition: '',
    model: '',

  }, opt)
  return (req, res, next) => {
    var {id} = req.params
    id = id.split('-')
    id.splice(2)
    if (!id[0] || !id[1]) return next('nf')

    return pgQuery(`SELECT ${opt.properties} FROM ${opt.type}s ${opt.condition}`,
    [id[0], Buffer.from(id[1], 'hex')])
    .then(q => q.rows)
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
      if (!res.created_by) return res

      if (res.created_by !== '00000000-0000-0000-0000-000000000000') {
        return pgQuery('SELECT shortened_id, username, display_name FROM users WHERE id=$1;',
        [res.created_by])
        .then(q => q.rows[0])
        .then(user => {
          if (user) {
            user.shortened_id = user.shortened_id.toString('hex')
            res.authorURL = `/user/${user.username}-${user.shortened_id}`
            res.author = user.display_name
          } else {
            res.author = 'Deleted User'
            pgQuery(`UPDATE paths SET created_by='00000000-0000-0000-0000-000000000000'
            WHERE id=$1`, [res.id])
          }
          return res
        })
      } else res.author = 'Deleted User'
      return res
    })
  }
}

module.exports.listResults = listResults
module.exports.pathGroup = pathGroup
module.exports.resourceGroup = resourceGroup
module.exports.objectPage = objectPage

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

app.post('/upload-file', (req, res, next) => {
  formidable(req, {
    outputPath: path.join(__dirname, '../public/')
  })
  .then(q => {
    console.log('app', q);
    res.send(q)
  })
  .catch(err => {
    console.log(err);
    res.send(err)
  })
})
