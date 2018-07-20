const express = require('express');
const valid = require('validator');

const {app} = require('./../server');
const {pgQuery} = require('./../db/pg');
const {Path} = require('./../models/path');
const {Resource} = require('./../models/resource');

// app.all('*', (req, res, next) => {
//   // req.user = {
//   //   emails: ['paul@marketinggen.com'],
//   //   img: '/img/paul.png',
//   //   username: 'PaulTok',
//   //   display_name: 'Paul Tokgozoglu',
//   //   first_name: 'Paul',
//   //   last_name: 'Tokgozoglu',
//   //   location: 'St. Robert, MO',
//   //   bio: 'Confused about how to start a business? Join the FREE BETA for our AI and it’ll help',
//   //   quote: '\"if they could see on my face what i feel in my heart, no one would ever fight me.\" -Yasuhiro Yamashita.',
//   //   friends: [],
//   //   created_date: '2018-07-11 07:52:01.361267',
//   //   avatar: 'paul.png'
//   // }
//   if (req.loggedIn) Object.assign(app.locals, {
//     'user-avatar': `/img/${req.user.avatar || 'default_avatar.png'}`,
//     'logged-in': true
//   });
//   else Object.assign(app.locals, {
//     'logged-in': false
//   });
//   next();
// });

app.get('/', (req, res) => {
  res.render('index.hbs', {
    title: 'Excelsior, the education and curation platform that fits you',
    message: 'Welcome to Excelsior'
  });
});

app.get('/path/', (req, res) => {
  res.redirect('/paths');
});

app.get('/paths', (req, res) => {
  res.render('paths.hbs', {
    title: 'Paths of Learning',
    translucent_header: true
  });
});

app.get('/unset-ext', (req, res) => {
  pgQuery('UPDATE users SET external_ids=DEFAULT WHERE id=\'c557cedc-c534-4c87-9b45-1794564e675e\';');
  res.redirect('back')
});

app.get('/path/:id', async (req, res, next) => {
  var {id} = req.params, q;

  // if (q.length === 1) {
  //   q = q[0];
  //   let {display_name} = q;
  //   return res.render('paths.hbs', {
  //     isPath: true,
  //     path: {display_name}
  //   });
  // } else if (q.length > 1) {
  //   // Which one did you mean?
  // } else {
  //   console.log('not found');
  // }
  // let q = await pgQuery('INSERT INTO paths (name, display_name) values (\'mindset\',\'Mindset\')');
  // res.render('paths.hbs', {
  //   isPath: true
  // });

  next();
});
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
