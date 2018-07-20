const express = require('express');
const valid = require('validator');

const {app} = require('./../app');
const {pgQuery} = require('./../db/pg');
const {Path} = require('./../models/path');
const {Resource} = require('./../models/resource');

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Excelsior, the education and curation platform that fits you',
    message: 'Welcome to Excelsior'
  });
});

app.get('/path/', (req, res) => {
  res.redirect('/paths');
});

app.get('/paths', (req, res) => {
  res.render('paths', {
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
