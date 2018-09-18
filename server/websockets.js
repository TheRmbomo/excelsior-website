const path = require('path')
const fs = require('fs')
const valid = require('validator')
const cookie = require('cookie')

const ws = require('./websockets-init')
const {errorlog} = require('./app')
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
const {sanitize, format_date, pick} = require('./middleware/utilities')

var parse_url = url => {return {
  name: url[0],
  short_id: Buffer.from(url[1], 'hex'),
  short_id_hex: url[1]
}},
invauth = {error: 'Invalid authentication'},
invreq = message => {
  var obj = {error: 'Invalid request'}
  if (message) obj.message = message
  return obj
},
err = send => e => (errorlog(e), send(invreq()))

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
  'show_name', 'show_joinDate', 'show_followedPaths', 'show_description',
  'show_excelsiorSkills', 'show_location', 'show_workHistory', 'show_externalSkills',
  'show_birthday', 'show_managedPaths'],
  path: ['description',
  'show_description'],
  resource: ['description', 'source', 'source_type',
  'show_description']
}

ws.on('ready', (socket, httpReq) => {
  var user = socket.user
  socket.on('log', req => {
    console.log(req);
  })


  ;(function inpath() {
    socket.on('inpath_init', (req, send) => {
      var {name, short_id} = parse_url(req.url.split('/')[2].split('-'))
      pgQuery(`SELECT id, created_at FROM paths WHERE name=$1 AND shortened_id=$2`,
        [name, short_id]
      ).then(q => q.rows[0])
      .then(path => Path.findById(path.id).then(doc => {
        doc = doc.toObject()
        delete path.id
        path.created_at = format_date(path.created_at)
        // var new_doc = {}
        // ;['description','content'].map(key => new_doc[key] = doc[key])
        // Object.assign(new_doc, path)
        var list = [],
        order = doc.content.map(resource => {
          if (!resource) return null
          var url = resource.url, index = list.indexOf(url)
          if (index === -1) var stackIndex = list.push(url) - 1
          else var stackIndex = index
          return {stackIndex, next: resource.next}
        }),
        resources = list.map(full_url => {
          if (!full_url) return Promise.resolve(null)
          var {name, short_id} = parse_url(full_url.split('/')[2].split('-'))
          return pgQuery(`SELECT id, display_name, rating, created_at,
            image_path FROM resources WHERE name=$1 AND shortened_id=$2`, [name, short_id]
          ).then(q => q.rows[0])
          .then(row => Resource.findById(row.id).then(doc => {
            delete row.id
            row.created_at = format_date(row.created_at)
            row.url = full_url
            doc = doc.toObject()
            var new_doc = pick(doc, ['description'])
            return Object.assign(new_doc, row)
          }))
          .catch(e => null)
        })

        return Promise.all(resources).then(resources => {
          path.content = {resources, order}
          return send(path)
        })
      }))
      .catch(err(send))
    })
  })()

  ;(function creator() {
    socket.on('creator_save', (req, send) => {
      if (!user) return send(invauth)
      var {save} = req, {name, short_id} = parse_url(req.url)

      pgQuery(`SELECT id FROM paths WHERE name=$1 AND shortened_id=$2`,
        [name, short_id]
      ).then(q => q.rows[0])
      .then(path => Path.findById(path.id))
      .then(doc => {
        if (!save[0]) return
        doc.content = []
        var stack = [[save[0],0]], i = 100-1
        while (stack.length && i > 0) {
          var item = stack.pop(), resource = item[0], index = item[1],
          next = resource.next
          if (resource.resource) {
            var url = resource.resource.url
            delete resource.resource
            resource.url = url
          }
          if (resource.test) {
            // TODO: conditionals
          }
          doc.content[index] = resource
          if (next, save[next]) stack.push([save[next], next])
          i--
        }
        return Path.updateOne({_id: doc._id}, {$set: {content: doc.content}})
      })
      .catch(err(send))
    })
    socket.on('creator_loadMenu', (req, send) => {
      if (!user) return send(invauth)
      pgQuery(`SELECT id, shortened_id, name, display_name, rating, created_by, created_at,
        image_path FROM resources`
      ).then(q => q.rows)
      .then(rows => Promise.all(rows.map(row => Resource.findById(row.id)
      .then(doc => {
        var doc = doc.toObject(), {description} = doc,
        new_doc = {description}
        row.created_at = format_date(row.created_at)
        row.url = `/content/${row.name}-${row.shortened_id.toString('hex')}`
        delete row.name; delete row.shortened_id;
        return pgQuery(`SELECT display_name, username, shortened_id
          FROM users WHERE id=$1`, [row.created_by]
        ).then(q => q.rows[0])
        .then(user => {
          delete row.created_by
          if (!user) return
          row.author = user.display_name
          row.author_url = `/user/${user.username}-${user.shortened_id.toString('hex')}`
          return new_doc
        })
      })
      .then(doc => Object.assign(row, doc)))))
      .then(send)
      .catch(e => console.log(e))
    })
    socket.on('creator_init', (req, send) => {
      if (!user) return send(invauth)
      var {url} = req, {name, short_id} = parse_url(req.url)
      if (!(req && req.url)) return send(invreq())
      pgQuery(`SELECT id FROM paths WHERE name=$1 AND shortened_id=$2`,
        [name, short_id]
      ).then(q => q.rows[0])
      .then(path => Path.findById(path.id))
      .then(doc => {
        if (!doc.content) return {status: 'new'}
        var res = {status: 'loaded', content: doc.content},
        stack = [[doc.content[0],0]], i = 100-1, promises = []
        while (stack.length && i > 0) {
          var resource = stack.pop(), {url, next} = resource[0]
          if (url) {
            var {name, short_id, short_id_hex} = parse_url(url.split('/')[2].split('-'))
            var promise = new Promise(resolve => {
              var index = resource[1], urlpath = `/content/${name}-${short_id_hex}`
              pgQuery(`SELECT id, display_name, shortened_id rating, created_by, created_at,
              image_path FROM resources WHERE name=$1 AND shortened_id=$2`, [name, short_id])
              .then(q => q.rows[0])
              .then(row => Resource.findById(row.id).then(doc => {
                delete row.id
                var doc = doc.toObject(), {description} = doc
                row.url = urlpath
                return resolve([Object.assign(row, {description}), index])
              }))
            })
            promises.push(promise)
          }
          if (typeof next === 'number' && doc.content[next]) {
            stack.push([doc.content[next], next])
          }
          i--
        }
        return Promise.all(promises).then(data => {
          data.map(data => res.content[data[1]].resource = data[0])
          return res
        })
      })
      .then(res => send(res))
      .catch(err(send))
    })
  })()

  socket.on('update_article', (req, send) => {
    if (!user) return send(invauth)
    if (!req) return send(invreq())

    var {name, short_id} = parse_url(url.split('-'))

    pgQuery(`SELECT id, name, shortened_id, created_by FROM resources
      WHERE name=$1 AND shortened_id=$2`, [name, short_id]
    ).then(q => q.rows[0])
    .then(resource => {
      if (!resource) throw 'No results found'
      if (resource.created_by !== user.id) throw 'Invalid authentication'
      pgQuery(`UPDATE resources SET last_modified_at=$2 WHERE id=$1`, [resource.id, new Date])
      return Resource.findById(resource.id).then(doc => {
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
    })
    .catch(err(send))
  })

  socket.on('check_model', (req, send) => {
    try {
      if (!user) return send(invauth)
      if (!req) return send(invreq())
      if (!req.type) return send(invreq('Type required'))
      if (req.type === 'user') {
        var name = user.name, shortened_id = Buffer.from(user.shortened_id, 'hex'),
        sql_name = 'username'
      }
      else {
        if (!req.id) return send(invreq('ID required'))
        var {name, short_id} = parse_url(req.id.split('-')), sql_name = 'name'
      }
      if (!valid.isIn(req.type, ['user','path','resource'])) {
        return send(invreq('Invalid type'))
      }
    }
    catch (e) {
      return err(send)(e)
    }

    pgQuery(`SELECT ${select_sql_properties[req.type]} FROM ${req.type}s
      WHERE ${sql_name}=$1 AND shortened_id=$2`, [name, short_id]
    ).then(q => q.rows[0])
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
        }
        else if (valid.isIn(key, mongo_properties[req.type])) {
          mongo_keys.push(key)
        }
      }
      if (!sql_keys.length && !mongo_keys.length) throw 'Invalid request'
      if (sql_keys.length) {
        var sql_query = pgQuery(`SELECT ${sql_keys.toString()}
          FROM ${req.type}s WHERE id=$1`, [res.id]
        ).then(q => q.rows[0])
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

      return Promise.all(queries).then(() => send(returnMessage))
    })
    .catch(err(send))
  })

  socket.on('update_model', (req, send) => {
    try {
      if (!user) return send(invauth)
      if (!req) return send(invreq())
      if (!req.type) return send(invreq('Type required'))
      if (req.type === 'user') {
        var name = user.name, shortened_id = Buffer.from(user.shortened_id, 'hex'),
        sql_name = 'username'
      }
      else {
        if (!req.id) return send(invreq('ID required'))
        var {name, short_id} = parse_url(req.id.split('-'))
        sql_name = 'name'
      }
      if (!valid.isIn(req.type, ['user','path','resource'])) {
        return send(invreq('Invalid type'))
      }
    }
    catch (e) {
      return err(send)(e)
    }

    if (req.properties.length > req.values.length) {
      req.properties = req.properties.slice(0, req.values.length)
    }
    else if (req.values.length > req.properties.length) {
      req.values = req.values.slice(0, req.properties.length)
    }

    pgQuery(`SELECT ${select_sql_properties[req.type]} FROM ${req.type}s
      WHERE ${sql_name}=$1 AND shortened_id=$2`, [name, short_id]
    ).then(q => q.rows[0])
    .then(res => {
      if (!res) throw 'No results found'
      if (res.created_by && res.created_by !== user.id) throw 'Invalid authentication'
      var sql_keys = [], sql_values = [],
      mongo_keys = [], mongo_values = [],
      queries = [],
      errors = [], returnMessage = {}

      for (var i = req.properties.length-1; i >= 0; i--) {
        var key = req.properties[i]
        try {
          var value = sanitize(key, req.values[i])
        }
        catch (e) {
          errors.push(e)
        }
        if (valid.isIn(key, sql_properties[req.type])) {
          sql_keys.push(key)
          sql_values.push(value)
          if (key === 'display_name') {
            returnMessage.display = value
          }
          if (valid.isIn(key, ['username', 'name'])) {
            returnMessage.redirect = `/${req.type}/${value}-${res.shortened_id.toString('hex')
            }/edit`
            if (req.type === 'resource' && req.schema === 'article' && req.original) {
              var file_path = path.join(__dirname, '../public/articles')
              fs.rename(`${file_path}/${res.name}-${res.shortened_id.toString('hex')}.html`,
              `${file_path}/${value}-${res.shortened_id.toString('hex')}.html`,
              err => errorlog(err))
              mongo_keys.push('source')
              mongo_values.push(`/articles/${value}-${res.shortened_id.toString('hex')}.html`)
            }
          }
        }
        else if (valid.isIn(key, mongo_properties[req.type])) {
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
        sql_places = (sql_places.length === 1) ? sql_places.toString() : `(${
        sql_places.toString()})`
        var sql_query = pgQuery(`UPDATE ${req.type}s SET ${sql_keys}=${sql_places}
          WHERE id=$1`, sql_values
        )
        queries.push(sql_query)
      }
      if (mongo_keys.length) {
        var mongo_query = models[req.type].findById(res.id)
        .then(doc => {
          for (var i = mongo_keys.length; i >= 0; i--) {
            doc[mongo_keys[i]] = mongo_values[i]
          }
          return doc.save()
        })
        queries.push(mongo_query)
      }

      return Promise.all(queries).then(() => {
        if (res.id && res.type !== 'user') pgQuery(`UPDATE ${req.type}s
          SET last_modified_at=$2 WHERE id=$1`, [res.id, new Date]
        ).catch(e => e)
        return send(returnMessage)
      })
    })
    .catch(err(send))
  })

  socket.on('is_following', (req, send) => {
    if (!user) return send(invauth)
    if (!(req && req.url)) return send(invreq())

    var {name, short_id} = parse_url(req.url.split('/')[2].split('-'))

    return pgQuery(`SELECT id = ANY((SELECT paths_following FROM users WHERE id=$3)::uuid[])
      AS in_array FROM paths WHERE name=$1 AND shortened_id=$2`, [name, short_id, user.id]
    ).then(q => send(q.rows[0].in_array))
  })

  socket.on('follow_path', (req, send) => {
    if (!user) return send(invauth)
    if (!(req && req.url)) return send(invreq())

    var {name, short_id} = parse_url(req.url.split('/')[2].split('-'))

    return pgQuery(`SELECT id FROM paths WHERE name=$1 AND shortened_id=$2`,
      [name, short_id]
    ).then(q => q.rows[0])
    .then(path => pgQuery(`UPDATE users SET paths_following = (SELECT ${
      `(CASE ${
        `WHEN $2=ANY(paths_following) THEN array_remove(paths_following,$2)
        ELSE array_append(paths_following,$2) `
      }END)::uuid[] as array `
    }FROM users WHERE id=$1) WHERE id=$1 RETURNING (SELECT ${
      `(CASE ${
        `WHEN $2=ANY(paths_following) THEN true
        ELSE false `
      }END) as in_array)`
    }`, [user.id, path.id]))
    .then(q => q.rows[0])
    .then(path => send({state: path.in_array}))
    .catch(err(send))
  })
})
