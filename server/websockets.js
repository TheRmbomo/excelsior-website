const valid = require('validator')
const cookie = require('cookie')

const ws = require('./websockets-init')
const {pgQuery} = require('./db/pg')
const Path = require('./db/models/path')
const User = require('./db/models/user')
const {sanitize} = require('./middleware/utilities')

var err = e => console.log(Error(e))

var update = (send, req, opt) => new Promise((resolve, reject) => {
  opt = Object.assign({
    error: {},
    is_error: () => Object.keys(opt.error).length,
    message: 'saved'
  }, opt)
  if (!req) throw 'Request required'
  if (opt.initial_query) return resolve(opt.initial_query)
  else resolve()
})
.then(q => {
  var sql = true,
  key = (() => {
    if (valid.isIn(req.key, opt.sql_keys)) {
      return req.key
    } else if (valid.isIn(req.key, opt.mongo_keys) || valid.matches(req.key, opt.mongo_regex)) {
      sql = false
      return req.key
    } else opt.error[req.key] = {type: 'Invalid property'}
    if (opt.is_error()) throw opt.error
  })(),
  value = sanitize(key, req.value)

  if (sql) {
    return pgQuery(`UPDATE ${opt.table}s SET ${key}=$2 WHERE id=$1
    RETURNING shortened_id`, [req.id, value])
    .then(q => q.rows[0])
    .then(res => {
      if (key === 'username' || key === 'name') {
        opt.message = {redirect: `/${opt.table}/${value}-${res.shortened_id.toString('hex')}/edit`}
      }
    })
  } else {
    return opt.mongo_query(value)
    .then(res => {
      if (res && res.message !== undefined) opt.message = res.message
    })
  }
})
.then(() => send(opt.message))
.catch(error => {
  console.log(error);
  if (typeof error !== 'string') send({error})
  return error
})

ws.on('ready', (socket, httpReq) => {
  var user = socket.user

  socket.on('check_property', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Invalid authentication'})

    var id = user.id, model = User, type = 'users'

    if (req.type && req.type === 'path') {
      if (!req.id) return send({error: 'Invalid request'})
      id = req.id
      model = Path
      type = 'paths'
    }

    pgQuery(`SELECT mongo_id FROM ${type} WHERE id=$1`, [id])
    .then(q => q.rows[0])
    .then(row => {
      if (!row) return send({error: 'Invalid request'})
      return model.findById(row.mongo_id)
    })
    .then(doc => {
      if (!doc) return send({error: 'Invalid request'})
      send(Object.keys(doc.toObject()).map(key => {
        if (valid.isIn(key, req.keys)) {
          return {key, value: doc[key]}
        }
      }).filter(i => i !== undefined))
    })
    .catch(e => console.log(e))
  })

  socket.on('edit_user', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Invalid authentication'})
    req.id = user.id

    update(send, req, {
      table: 'user',
      sql_keys: ['is_public', 'display_name', 'first_name', 'last_name', 'username', 'birthday',
      'language'],
      mongo_keys: ['description', 'location'],
      mongo_regex: /show_.*/,
      mongo_query: value => pgQuery(`SELECT mongo_id FROM users WHERE id=$1`, [user.id])
      .then(q => q.rows[0])
      .then(user => User.findById(user.mongo_id))
      .then(doc => {
        if (value === 'toggle') value = !doc[req.key]
        return doc.update({[req.key]: value}).then(() => value)
      })
      .then(value => {return {message: value}})
    })
  })

  socket.on('edit_path', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Invalid authentication'})
    if (!req.id) return send({error: 'No path ID'})

    update(send, req, {
      table: 'path',
      sql_keys: ['is_public', 'display_name', 'name'],
      mongo_keys: ['description'],
      mongo_regex: /show_.*/,
      initial_query: pgQuery(`SELECT created_by, mongo_id FROM paths WHERE id=$1`, [req.id])
      .then(q => q.rows[0])
      .then(path => {
        if (!path) throw Error('Path Missing')
        req.mongo_id = path.mongo_id
      }),
      mongo_query: value => Path.findById(req.mongo_id)
      .then(doc => {
        if (value === 'toggle') value = !doc[req.key]
        return doc.update({[req.key]: value}).then(() => value)
      })
      .then(value => {return {message: value}})
    })
  })

  socket.on('is_following', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Not logged in'})
    if (!req.id) return send({error: 'No path ID'})

    pgQuery(`SELECT id = ANY((SELECT paths_following FROM users WHERE id=$2)::uuid[])
    AS in_array FROM paths WHERE id=$1`, [req.id, user.id])
    .then(q => send(q.rows[0].in_array))
  })

  socket.on('follow_path', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Not logged in'})
    if (!req.id) return send({error: 'No path ID'})

    pgQuery(`UPDATE users SET paths_following = (SELECT
      (CASE
        WHEN $2=ANY(paths_following) THEN array_remove(paths_following,$2)
        ELSE array_append(paths_following,$2)
      END)::uuid[] as array
    FROM users WHERE id=$1) WHERE id=$1 RETURNING (SELECT
      (CASE
        WHEN $2=ANY(paths_following) THEN true
        ELSE false
      END) as in_array)`, [user.id, req.id])
    .then(q => q.rows[0])
    .then(path => send({state: path.in_array}))
    .catch(e => console.log(Error(e)))
  })
})
