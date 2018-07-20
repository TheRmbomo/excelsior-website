const fs = require('fs');
const path = require('path');
const express = require('express');
const {ObjectID} = require('mongodb');
const xss = require('xss');
const scrypt = require('scrypt');
const valid = require('validator');
const passport = require('passport');
const uuid = require('uuid/v4');
const uuidParse = require('uuid-parse').parse;

const {app} = require('./../app');
const {pgQuery} = require('./../db/pg');
const {shortenId, loginCB} = require('./../middleware/passport');

var defaultAvatar = '/img/default_avatar.png'

app.get('/logout', (req, res) => {
  console.log('Logged out');
  req.logout();
  res.locals['logged-in'] = false;
  res.redirect('/login');
});

app.route('/create-user')
.get((req, res) => {
  res.redirect('back')
})
.post(async (req, res, next) => {
  req.logout();
  let {email, password} = req.body, error = {};

  if (!email) error.email = {type: 'required'};
  else if (!valid.isEmail(email + '')) error.email = {type: 'invalid'};
  else {
    let emailsReq = await pgQuery('SELECT unnest(emails) FROM users')
    .catch(e => console.log(Error(e)))
    for (var i=emailsReq.rows.length-1; i>=0; i--) {
      if (emailsReq.rows[i].unnest === email) error.email = {type: 'taken'};
    }
  }
  if (!password) error.password = {type: 'required'};
  else if (!valid.isLength(password + '', {min: 6})) error.password = {type: 'length'};
  if (Object.keys(error).length) return next(JSON.stringify(error));

  let sctParams = await scrypt.params(0.5).catch(error => {return {error}});
  if (sctParams.error) {
    // Generating Scrypt Parameters
    // do a thing, maybe send static req property for error
    return console.log(sctParams.error);
  }
  let kdfRes = await scrypt.kdf(password, sctParams);
  let q = await pgQuery(`INSERT INTO users (emails, hashed_password)
  values (ARRAY[$1],$2) RETURNING id`, [email, kdfRes])
  .catch(e => {
    console.log(Error(e))
    return next();
  })
  let user = q.rows[0];

  console.log('PLACEHOLDER: Email sent');
  user.shortened_id = shortenId(user.id);

  req.login(user, err => {
    if (err) return next(err);

    console.log(req.user);
    return res.redirect(`/user/user-${req.user.shortened_id.toString('hex')}`);
  });
  return res.redirect('back');
});

app.get('/login-user', (req, res) => {
  res.redirect('back');
});

app.get('/login', (req, res) => {
  console.log('req.session.passport =', req.session.passport);
  res.render('login', {
    title: 'Sign-in'
  });
});

app.get('/users', async (req, res, next) => {
  let data = {};

  let q = await pgQuery(`SELECT display_name, username, shortened_id, avatar_path FROM users`)
  .catch(e => {
    console.log(Error(e))
    return next()
  })
  q.rows.map(user => {
    user.shortened_id = user.shortened_id.toString('hex');
    if (!user.avatar_path) user.avatar_path = defaultAvatar
    if (!user.username) user.username = 'user';
  });
  data.users = q.rows;

  res.render('multilist', {
    title: 'Multiple Results',
    data
  });
});

var userRouter = express.Router();
app.use('/user/:id', async (req, res, next) => {
  var {id} = req.params;

  id = id.split('-');
  id.splice(2);

  var q, user, temp_table = 't' + new Buffer(uuidParse(uuid())).toString('hex');
  if (id.length === 1) {
    return next();
    // username
      // Unique, redirect
      // Shared, we've found multiple
    // id
      // Match
    // If Match, redirect
  } else {
    if (id[0] === 'user') {
      q = await pgQuery(`SELECT id FROM users
        WHERE shortened_id=$1;`, [new Buffer(id[1], 'hex')])
      .catch(e => console.log(Error(e)))
      user = q.rows[0];
    }
    else try {
      await pgQuery(`CREATE TABLE ${temp_table} AS (SELECT id, shortened_id
        FROM users WHERE username=$1);`, [id[0]]);
      q = await pgQuery(`SELECT * FROM ${temp_table};`);
      if (!q.rows.length) return next(); // Username didn't match anyone
      else if (q.rows.length === 1) { // Unique username
        let userId = q.rows[0].shortened_id.toString('hex');
        if (userId !== id[1]) return res.redirect(`/user/${id[0]}-${userId}`);
        q.rows[0].url = `${id[0]}-${userId}`;
      } else { // Shared username
        q = await pgQuery(`SELECT * FROM ${temp_table}
          WHERE shortened_id=$1;`, [new Buffer(id[1], 'hex')]);
        if (!q.rows.length) return next(); // Unknown id
        else if (q.rows.length > 1) { // Id collision
          console.log(Error('ERROR: SHORTENED_ID COLLISION'))
          // TODO: Handle s_id collisions, reassign them
          return next();
        }
      }
      user = q.rows[0];
    } catch (e) { console.log(Error(e)) }
    pgQuery(`DROP TABLE IF EXISTS ${temp_table};`)
    .catch(e => console.log(Error(e)))
  }
  q = await pgQuery(`SELECT username, nosql_id, first_name, last_name,
    display_name, avatar_path, age, friends, currency, created_date
    FROM users WHERE id=$1`, [user.id])
  .catch(e => console.log(Error(e)))
  Object.assign(user, q.rows[0]);

  user.created_date = req.format_date(user.created_date);

  user.avatar_path = user.avatar_path || defaultAvatar
  req.viewedUser = user;

  Object.assign(res.locals, {
    user,
    ownPage: (req.user) ? id[1] === req.user.shortened_id : false,
    title: (user && user.display_name) ? user.display_name : 'User Profile'
  });
  next();
}, userRouter);

userRouter.get('/', async (req, res, next) => {
  let user = req.viewedUser;
  if (!user) return next();

  res.render('user_profile');
});

userRouter.get('/edit', (req, res, next) => {
  let user = req.viewedUser;
  if (!user) return next();

  if (user.id !== req.user.id) return res.redirect(`/user/${user.url}`);

  res.render('user_profile.hbs', {
    edit: true
  });
});

app.post('/edit-profile', async (req, res) => {
  if (!req.user) return res.redirect('back')

  let error = {}, bodyKeys = Object.keys(req.body);
  bodyKeys.map(key => {
    switch (key) {
      case 'first_name':
        if (req.body[key]) break;
        error[key] = {type: 'required'};
      case 'avatar':
        // console.log(req.body[key]);
        delete req.body[key];
        bodyKeys.splice(bodyKeys.indexOf(key), 1);
        if (key === 'first_name') break;
        req.body['avatar_path'] = '';
        bodyKeys.push('avatar_path');
        return;
      case 'username':
        req.body[key] = req.body[key].split(/\W/).join('');
        break;
    }
  });
  let update_keys = bodyKeys.map(key => `${key}`).join(','),
  update_values = Object.values(req.body),
  update_values_spot = (length => {
    // +1 and >2 to make room for the user id
    for (var i=length+1, array=[]; array.push('$'+i), i>2; i--);
    return array.reverse().join(',');
  })(bodyKeys.length);

  if (bodyKeys.length > 1) {
    update_keys = `(${update_keys})`;
    update_values_spot = `(${update_values_spot})`;
  }
  let update = `${update_keys}=${update_values_spot}`;
  let parameters = [req.user.id].concat(update_values), user;
  // console.log(update, parameters);
  let q = await pgQuery(`UPDATE users SET ${update} WHERE id=$1
    RETURNING username, shortened_id;`, parameters)
  .catch(e => console.log(Error(e)))
  user = q.rows[0];
  user.shortened_id = user.shortened_id.toString('hex');
  if (user) {
    return res.redirect(`/user/${user.username}-${user.shortened_id}/edit`);
  } else return res.redirect('back');
});

app.get('/my-files', async (req, res) => {
  if (!req.user) return res.redirect('/login')

  let q, full = false, files
  q = await pgQuery(`SELECT id AS image_id, name, path, size, type, created_at,
    times_accessed, last_accessed FROM files WHERE owner=$1;`, [req.user.id])
  .catch(e => {
    console.log(Error(e))
    return res.redirect('back')
  })

  let taken_space = q.rows.reduce((acc,cur) => acc + cur.size, 0);
  if (taken_space >= 1024 * 1024 * 5) full = true

  files = q.rows
  files.map(file => Object.keys(file).map(key => {
    switch (key) {
      case 'size':
        file[key] = Math.floor(file[key]/(1024*1024) * 100) / 100
        file[key] += ' MB'
        break;
      case 'created_at':
      case 'last_accessed':
        file[key] = req.format_date(file[key])
        break;
      case 'type':
        if (file[key].substr(0,5) !== 'image') {
          file['path'] = '/img/default_file.png'
        }
    }
  }))

  taken_space = Math.floor(taken_space/(1024 * 1024) * 1000) / 1000

  res.render('my_files.hbs', {
    title: 'My Files',
    taken_space,
    remaining_space: Math.floor((5 - taken_space) * 1000) / 1000,
    files
  })
})

app.post('/upload-file', async (req, res) => {
  res.redirect('back')
  if (!req.user) return

  q = await pgQuery(`SELECT id AS image_id, name, path, size, type, created_at,
    times_accessed, last_accessed FROM files WHERE owner=$1;`, [req.user.id])
  .catch(e => {
    console.log(Error(e))
    return res.redirect('back')
  })

  let taken_space = q.rows.reduce((acc,cur) => acc + cur.size, 0);
  if (taken_space >= 1024 * 1024 * 5) return

  let upload = await require('./../middleware/formidable')(req,res)
  if (upload.error) return
  if (upload.files[0].size + taken_space >= 1024 * 1024 * 5) {
    fs.unlink(path.join(app.locals.absolutePath, 'public/', 'files/', upload.filename), err => err)
    return
  }
  let file = upload.files[0], filePath = '/'

  if (file.type.substr(0,5) === 'image') {
    let public = path.join(app.locals.absolutePath, 'public/')
    fs.rename(path.join(public, 'files/', upload.filename), path.join(public, 'img/', upload.filename), err => err)
    filePath += 'img/'
  }

  pgQuery(`INSERT INTO files (name, owner, path, size, type)
  values ($1, $2, $3, $4, $5);`, [file.name,req.user.id,`${filePath}${upload.filename}`,file.size,file.type])
  .catch(e => {
    // fs.unlink()
    console.log(Error(e))
  })
})

app.post('/delete-file', express.json(), express.urlencoded({extended: true}), (req, res) => {
  res.redirect('back')
  if (!req.user) return
  let {image_id, file_name} = req.body;

  if (req.body['change-avatar']) {
    pgQuery('UPDATE users SET avatar_path=$2 WHERE id=$1', [req.user.id, file_name])
    .catch(e => console.log(Error(e)))
    return
  }

  if (req.user.avatar_path === file_name) {
    pgQuery('UPDATE users SET avatar_path=NULL WHERE id=$1', [req.user.id])
    .catch(e => console.log(Error(e)))
  }

  pgQuery('SELECT owner, path FROM files WHERE id=$1', [image_id])
  .then(a => a.rows[0]).then(async row => {
    if (row.owner === req.user.id) {
      let error;
      await fs.unlink(path.join(app.locals.absolutePath, '/public', row.path), err => (err) ? error = err : '')
      if (error && error.errno !== -4058) throw error
      pgQuery('DELETE FROM files WHERE id=$1', [image_id])
      .catch(e => console.log(Error(e)))
    } else console.log('Not the owner')
  })
  .catch(e => console.log(Error(e)))
})
