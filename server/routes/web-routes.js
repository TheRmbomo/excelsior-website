const express = require('express')
const valid = require('validator')
const hbs = require('hbs')

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const {shortenId} = require('./../middleware/passport')
const Path = require('./../db/models/path')

let err = e => console.log(Error(e))

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Excelsior, the education and curation platform that fits you',
    message: (req.user) ? '' : 'Welcome to Excelsior'
  })
})

app.get('/questions', async (req, res) => {
  let questions = await pgQuery(`SELECT id, first_name, last_name, question, asked_at,
  answer, answered_by, answered_at
  FROM questions ORDER BY asked_at DESC;`)
  .then(q => q.rows)
  .then(questions => {
    questions.map(question => {
      question.asked_at = req.format_date(question.asked_at, true)
      if (question.answered_at) question.answered_at = req.format_date(question.answered_at, true)
    })
    return questions
  })
  .catch(e => console.log(Error(e)))

  res.render('questions', {
    title: 'Questions Page',
    questions
  })
})

app.post('/answer-question', express.json(), express.urlencoded({extended: true}),
(req, res) => {
  pgQuery(`UPDATE questions SET (answer,answered_by,answered_at)=($2,$3,now())
  WHERE id=$1;`, [req.body.id, req.body.answer, req.body.answered_by])
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

app.get('/path/create', (req, res) => {
  if (!req.user) return res.redirect('/login')

  author = {}
  author.name = (req.user.display_name) ? req.user.display_name
  : (req.user.username) ? req.user.username : req.user.shortened_id

  res.render('create_path', {
    title: 'Creating a Path of Learning',
    author
  })
})

app.route('/create-path')
.get((req, res) => res.redirect('/path/create'))
.post(express.json(), express.urlencoded({extended: true}), (req, res, next) => {
  if (!req.user) return res.status(401).send('Must be logged in.')

  let {display_name, tags} = req.body
  if (!display_name) return res.status(400).send('Display name required.')
  if (!valid.isLength(display_name, {min: 6, max: 50})) return res.status(400).send('Display name must be between 6-50 characters long.')

  let name = display_name.trim().toLowerCase().split(/\W+/).join('_')
  tags = Array.from(new Set(tags.trim().toLowerCase().split(/\W+/)))

  let path = new Path(),
  mongo_id = path.save().then(d => d._id)

  pgQuery(`INSERT INTO paths (name, display_name, tags, created_by, last_modified_by, contributors)
  VALUES ($1,$2,$3,$4,$4,ARRAY[$4]::uuid[]) RETURNING id;`, [name, display_name, tags, req.user.id])
  .then(q => q.rows[0])
  .then(async row => {
    let shortened_id = shortenId(row.id)
    console.log('Created path');
    pgQuery(`UPDATE paths SET (shortened_id,mongo_id)=($2,$3) WHERE id=$1;`, [row.id, shortened_id, (await mongo_id).toString()])
    return res.redirect(`/path/${name}-${shortened_id.toString('hex')}`)
  })
  .catch(e => {
    err(e)
    return res.redirect('back')
  })
  // pgQuery(`SELECT string_agg(tags, ',') as tags FROM paths;`)
})

app.get('/paths', (req, res, next) => {
  let listings = [],
  path_sql_properties = 'shortened_id, name, display_name, image_path, last_modified, mongo_id',
  list_paths = rows => {
    let paths = rows.reduce((text, row) => {
      let following = (req.user && req.user.paths_following && req.user.paths_following.indexOf(row.id) !== -1),
      doc = Path.find({})
      row.last_modified = req.format_date(row.last_modified)
      if (!row.name || !row.shortened_id) return text
      row.url = `/path/${row.name}-${row.shortened_id.toString('hex')}`
      /*<div style="max-width: 25em; max-height: 5em; overflow: hidden;">
      {{description}}
      </div>*/
      // row.description = 'This is a description of a legendary path of learning that will be sure to wow and amaze even the most skeptical and cynical of readers.'
      // if (row.description.length > 80) row.description = row.description.slice(0,80).trim() + '...'
      return text + hbs.compile(`{{> path_listing following=${following}}}`)(row)
    }, '')
    return paths
  }

  Promise.all([
    new Promise((resolve, reject) => {
      if (!req.user) reject('Not signed in.')
      pgQuery(`SELECT ${path_sql_properties} FROM paths
      WHERE id = ANY((SELECT paths_following FROM users WHERE id=$1)::uuid[])
      ORDER BY last_modified DESC;`, [req.user.id])
      .then(q => resolve(q))
      .catch(e => {
        err(e)
        resolve(e)
      })
    })
    .then(q => {
      if (q.rows) return list_paths(q.rows)
      else return null
    })
    .then(paths => {
      let message, group_name = 'Currently Following'
      if (req.user) message = `You aren't following any paths yet.`
      if (!paths) paths = `<div class="tr">
      <div class="td center round dark background padding">${message}</div>
      </div>`
      paths = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${paths}</div>`)
      listings.push({group_name, paths})
    })
    .catch(e => e),
    pgQuery(`SELECT ${path_sql_properties} FROM paths ORDER BY last_modified DESC LIMIT 100;`)
    .then(q => {
      if (q.rows) return list_paths(q.rows)
      else return null
    })
    .then(paths => {
      let group_name = 'All Paths'
      if (!paths) paths = `<div class="tr">
      <div class="td center round dark background padding">No paths were found. Likely an error.
      Please make sure you report this by <a href="#">clicking here.</a></div>
      </div>`
      paths = new hbs.SafeString(`<div class="island table" style="max-width: 45em;">${paths}</div>`)
      listings.push({group_name, paths})
    })
  ])
  .then(() => {
    listings = listings.reduce((text, group) => {
      return new hbs.SafeString(text + hbs.compile('{{> path_group}}')(group))
    }, '')

    return res.render('list_paths', {
      title: 'Your Paths of Learning',
      listings
    })
  })
  .catch(e => {
    err(e)
    return res.send()
  })
})

app.get('/paths/:id', (req, res) => {
  res.redirect(`/path/${req.params.id}`)
})

app.get('/path/:id', async (req, res, next) => {
  var {id} = req.params
  id = id.split('-')
  id.splice(2)
  if (!id[0]) return next()

  pgQuery(`SELECT id, display_name, created_by, created_at, last_modified_by,
  last_modified, image_path, contributors, mongo_id FROM paths
  WHERE name=$1 AND shortened_id=$2;`, [id[0], new Buffer(id[1], 'hex')])
  .then(q => q.rows)
  .then(async rows => {
    if (!rows.length) throw 'no path'
    if (rows.length > 1) throw 'multiple paths' // TODO: Redirect to search

    let path = rows[0],
    doc = await Path.findById(path.mongo_id)
    path.description = doc.description
    path.comments = doc.commentList.comments
    path.reviews = doc.reviewList.reviews
    path.content = doc.content

    if (path.created_by != '00000000-0000-0000-0000-000000000000') {
      path.author = (await pgQuery('SELECT shortened_id, username, display_name FROM users WHERE id=$1;', [path.created_by])).rows[0]
      if (path.author) {
        path.author.shortened_id = path.author.shortened_id.toString('hex')
        path.authorURL = `/user/${path.author.username ? path.author.username : 'user'}-${path.author.shortened_id}`
        path.author = path.author.display_name || path.author.username || `User ${path.author.shortened_id}`
      } else {
        path.author = 'Deleted User'
        pgQuery(`UPDATE paths SET created_by='00000000-0000-0000-0000-000000000000'
        WHERE id=$1;`, [path.id])
        .catch(e => err(e))
      }
    } else path.author = 'Deleted User'

    path.contributors = path.contributors || []
    path.contributors = `${path.contributors.length} ${path.contributors.length !== 1 ? 'People' : 'Person'}`
    path.contentCount = `${path.contentCount} ${path.contentCount !== 1 ? 'Resources' : 'Resource'}`
    return res.render('path', {
      path,
      title: path.display_name
    })
  })
  .catch(e => {
    err(e)
    return next()
    next()
  })
})
//
// app.get('/paths/:pathid/:videoid', (req, res) => {
//   let {pathid, videoid} = req.params;
//   Path.findById(pathid).then(path => {
//     if (!path) return req.renderPage('notfound.hbs', {});
//     let video = path.content.id(videoid);
//     req.renderPage('video-bare.hbs', {
//       translucent_header: true,
//       path, video
//     });
//   }).catch(e => res.send(e));
// });
//
// app.get('/video/:id', (req, res) => {
//   let {id} = req.params;
// });
//
// app.get('/not_found', (req, res) => {
//   req.renderPage('notfound.hbs')
// });
//
// app.get(process.env.EXCADMIN_PAGE, (req, res) => {
//   req.renderPage('admin.hbs', {});
// });
