const path = require('path')
const fs = require('fs')
const valid = require('validator')
const cookie = require('cookie')

const ws = require('./websockets-init')
const {pgQuery} = require('./db/pg')
const User = require('./db/models/user')
const Path = require('./db/models/path')
const Resource = require('./db/models/resource')
const models = {
  User, Path, Resource,
  user: User,
  path: Path,
  resource: Resource
}
const {sanitize} = require('./middleware/utilities')

var err = e => console.log(Error(e))

var sql_properties = {
  user: ['is_public', 'display_name', 'first_name', 'last_name', 'username', 'birthday',
  'language'],
  path: ['is_public', 'display_name', 'name', 'tags'],
  resource: ['is_public', 'display_name', 'name', 'tags']
},
select_sql_properties = {
  user: ['id','shortened_id'],
  path: ['id','created_by','shortened_id'],
  resource: ['id','created_by','shortened_id', 'name']
},
mongo_properties = {
  user: ['description', 'location',
  'show_name', 'show_joinDate', 'show_followedPaths', 'show_description', 'show_excelsiorSkills',
  'show_location', 'show_workHistory', 'show_externalSkills', 'show_birthday', 'show_managedPaths'],
  path: ['description',
  'show_description'],
  resource: ['description', 'source', 'source_type',
  'show_description']
}

ws.on('ready', (socket, httpReq) => {
  var user = socket.user

  socket.on('update_article', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Invalid authentication'})
    var resource

    var id = req.id.split('-'), name = id[0], shortened_id = Buffer.from(id[1], 'hex')

    pgQuery(`SELECT id, name, shortened_id, created_by FROM resources
    WHERE name=$1 AND shortened_id=$2`, [name, shortened_id])
    .then(q => q.rows[0])
    .then(qResource => {
      resource = qResource
      if (resource.created_by !== user.id) throw 'Invalid authentication'
      return Resource.findById(resource.id)
    })
    .then(doc => {
      if (!doc) throw 'Resource missing'
      if (doc.__t !== 'Article') throw 'Invalid resource: Must be article'
      var file_name = `${resource.name}-${resource.shortened_id.toString('hex')}.html`,
      article_path = path.join(__dirname, '../public/articles/', file_name),
      file_stream = fs.createWriteStream(article_path)

      doc.source = `/articles/${file_name}`
      doc.save()
      file_stream.once('open', fd => {
        file_stream.write(req.text)
        file_stream.end()
      })
      send('done')
    })
    .catch(e => {
      console.log(e);
      send({error: e})
    })
  })

  socket.on('check_model', (req, send) => {
    try {
      if (!req) return send({error: 'Invalid request', message: 'Request required'})
      if (!user) return send({error: 'Invalid authentication'})
      if (!req.type) return send({error: 'Invalid request', message: 'Type required'})
      if (req.type === 'user') {
        var name = user.name, shortened_id = user.shortened_id,
        sql_name = 'username'
      } else {
        if (!req.id) return send({error: 'Invalid request', message: 'ID required'})
        var id = req.id.split('-'), name = id[0], shortened_id = Buffer.from(id[1], 'hex'),
        sql_name = 'name'
      }
      if (!valid.isIn(req.type, ['user','path','resource'])) {
        return send({error: 'Invalid request', message: 'Invalid type'})
      }
    } catch (e) {
      console.log(e);
      return send({error: 'Invalid request'})
    }


    pgQuery(`SELECT ${select_sql_properties[req.type]} FROM ${req.type}s
    WHERE ${sql_name}=$1 AND shortened_id=$2`, [name, shortened_id])
    .then(q => q.rows[0])
    .then(res => {
      if (!res) throw 'No results found'
      if (res.created_by && res.created_by !== user.id) throw 'Invalid authentication'
      var sql_keys = [],
      mongo_keys = [],
      queries = [],
      returnMessage = {}

      for (var i = req.properties.length-1; i >= 0; i--) {
        var key = req.properties[i]
        if (valid.isIn(key, sql_properties[req.type])) {
          sql_keys.push(key)
        } else if (valid.isIn(key, mongo_properties[req.type])) {
          mongo_keys.push(key)
        }
      }
      if (!sql_keys.length && !mongo_keys.length) throw 'Invalid request'
      if (sql_keys.length) {
        var sql_query = pgQuery(`SELECT ${sql_keys.toString()}
        FROM ${req.type}s WHERE id=$1`, [res.id])
        .then(q => q.rows[0])
        .then(res => {
          for (var i = 0; i < sql_keys.length; i++) {
            returnMessage[sql_keys[i]] = doc[sql_keys[i]]
          }
        })
        queries.push(sql_query)
      }
      if (mongo_keys.length) {
        var mongo_query = models[req.type].findById(res.id)
        .then(doc => {
          for (var i = 0; i < mongo_keys.length; i++) {
            returnMessage[mongo_keys[i]] = doc[mongo_keys[i]]
          }
        })
        queries.push(mongo_query)
      }

      return Promise.all(queries).then(() => returnMessage)
    })
    .then(res => {
      // console.log(res);
      send(res)
    })
    .catch(error => {
      err(error)
      send({error})
    })
  })

  socket.on('update_model', (req, send) => {
    try {
      if (!req) return send({error: 'Invalid request', message: 'Request required'})
      if (!user) return send({error: 'Invalid authentication'})
      if (!req.type) return send({error: 'Invalid request', message: 'Type required'})
      if (req.type === 'user') {
        var name = user.name, shortened_id = user.shortened_id,
        sql_name = 'username'
      } else {
        if (!req.id) return send({error: 'Invalid request', message: 'ID required'})
        var id = req.id.split('-'), name = id[0], shortened_id = Buffer.from(id[1], 'hex'),
        sql_name = 'name'
      }
      if (!valid.isIn(req.type, ['user','path','resource'])) {
        return send({error: 'Invalid request', message: 'Invalid type'})
      }
    } catch (e) {
      // console.log(e);
      return send({error: 'Invalid request'})
    }

    if (req.properties.length > req.values.length) {
      req.properties = req.properties.slice(0, req.values.length)
    } else if (req.values.length > req.properties.length) {
      req.values = req.values.slice(0, req.properties.length)
    }

    pgQuery(`SELECT ${select_sql_properties[req.type]} FROM ${req.type}s
    WHERE ${sql_name}=$1 AND shortened_id=$2`, [name, shortened_id])
    .then(q => q.rows[0])
    .then(res => {
      if (!res) throw 'No results found'
      if (res.created_by && res.created_by !== user.id) throw 'Invalid authentication'
      var sql_keys = [],
      sql_values = [],
      mongo_keys = [],
      mongo_values = [],
      queries = [],
      errors = [],
      returnMessage = {}

      for (var i = req.properties.length-1; i >= 0; i--) {
        var key = req.properties[i]
        try {
          var value = sanitize(key, req.values[i])
        } catch (e) {
          errors.push(e)
        }
        if (valid.isIn(key, sql_properties[req.type])) {
          sql_keys.push(key)
          sql_values.push(value)
          if (key === 'display_name') {
            returnMessage.display = value
          }
          if (valid.isIn(key, ['username', 'name'])) {
            returnMessage.redirect = `/${req.type}/${value}-${res.shortened_id.toString('hex')}/edit`
            if (req.type === 'resource') {
              var file_path = path.join(__dirname, '../public/articles')
              fs.rename(`${file_path}/${res.name}-${res.shortened_id.toString('hex')}.html`,
              `${file_path}/${value}-${res.shortened_id.toString('hex')}.html`,
              err => console.log(err))
              mongo_keys.push('source')
              mongo_values.push(`/articles/${value}-${res.shortened_id.toString('hex')}.html`)
            }
          }
        } else if (valid.isIn(key, mongo_properties[req.type])) {
          mongo_keys.push(key)
          mongo_values.push(value)
        }
      }
      if (errors.length) throw errors
      if (!sql_keys.length && !mongo_keys.length) throw 'Invalid request'
      if (sql_keys.length) {
        var sql_places = sql_values.map((v,i) => `$${i+2}`)
        sql_values.unshift(res.id)
        sql_keys = (sql_keys.length === 1) ? sql_keys.toString() : `(${sql_keys.toString()})`
        sql_places = (sql_places.length === 1) ? sql_places.toString() : `(${sql_places.toString()})`
        var sql_query = pgQuery(`UPDATE ${req.type}s SET ${sql_keys}=${sql_places}
        WHERE id=$1`, sql_values)
        queries.push(sql_query)
      }
      if (mongo_keys.length) {
        var mongo_query = models[req.type].findById(res.id)
        .then(doc => {
          for (var i = mongo_keys.length; i >= 0; i--) {
            // if (mongo_values[i] === 'toggle') doc[mongo_keys[i]] = !doc[mongo_keys[i]]
            doc[mongo_keys[i]] = mongo_values[i]
          }
          return doc.save()
        })
        queries.push(mongo_query)
      }

      return Promise.all(queries).then(() => returnMessage)
    })
    .then(res => {
      // console.log(res);
      send(res)
    })
    .catch(error => {
      err(error)
      send({error})
    })
  })

  socket.on('is_following', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Not logged in'})
    if (!req.id) return send({error: 'No path ID'})

    var id = req.id.split('-'), name = id[0], shortened_id = Buffer.from(id[1], 'hex')

    pgQuery(`SELECT id = ANY((SELECT paths_following FROM users WHERE id=$3)::uuid[])
    AS in_array FROM paths WHERE name=$1 AND shortened_id=$2`, [name, shortened_id, user.id])
    .then(q => send(q.rows[0].in_array))
  })

  socket.on('follow_path', (req, send) => {
    if (!req) return send({error: 'Invalid request'})
    if (!user) return send({error: 'Not logged in'})
    if (!req.id) return send({error: 'No path ID'})

    var id = req.id.split('-'), name = id[0], shortened_id = Buffer.from(id[1], 'hex')
    pgQuery(`SELECT id FROM paths WHERE name=$1 AND shortened_id=$2`, [name, shortened_id])
    .then(q => q.rows[0])
    .then(path => pgQuery(`UPDATE users SET paths_following = (SELECT
      (CASE
        WHEN $2=ANY(paths_following) THEN array_remove(paths_following,$2)
        ELSE array_append(paths_following,$2)
      END)::uuid[] as array
    FROM users WHERE id=$1) WHERE id=$1 RETURNING (SELECT
      (CASE
        WHEN $2=ANY(paths_following) THEN true
        ELSE false
      END) as in_array)`, [user.id, path.id]))
    .then(q => q.rows[0])
    .then(path => send({state: path.in_array}))
    .catch(error => {
      err(error)
      send('error')
    })
  })
})
