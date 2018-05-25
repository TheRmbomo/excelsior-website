const express = require('express');
const bodyParser = require('body-parser');
const {ObjectId} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {Path} = require('./../models/path');
const {Resource} = require('./../models/resource');
const {authenticate, loggedin, defProps} = require('./../middleware/authenticate');

var renderPage = (res, link, options) => res.render(link, Object.assign({}, defProps, options));

app.all('*', loggedin, (req, res, next) => {
  next();
});

app.get('/', (req, res) => {
  renderPage(res, 'home.hbs', {
    pageTitle: 'Excelsior, the education and curation platform that fits you',
    home: true
  });
});

app.get('/about', (req, res) => {
  renderPage(res, 'about.hbs', {
    pageTitle: 'About Excelsior Industries'
  });
});

app.get('/login', loggedin, (req, res) => {
  if (!req.loggedIn)
    renderPage(res, 'login.hbs', {
      login: true
    });
  else res.redirect('/users/me');
});

app.get('/paths', (req, res) => {
  renderPage(res, 'paths.hbs', {
    pageTitle: 'Paths of Learning',
    translucent_header: true
  });
});

app.get('/paths/explore', (req, res) => {
  renderPage(res, 'explore.hbs', {
  });
});

app.get('/paths/:id', (req, res) => {
  var {id} = req.params;
  Path.findById(id).then(path => {
    if (!path) return renderPage(res, 'notfound.hbs', {});
    renderPage(res, 'paths.hbs', {
      isPath: true,
      pageTitle: path.name,
      rating: `${Math.floor(path.rating*100)}%`,
      path
    });
  }).catch(e => {
    renderPage(res, 'notfound.hbs', {});
  });
});

app.get('/paths/:pathid/:videoid', (req, res) => {
  let {pathid, videoid} = req.params;
  Path.findById(pathid).then(path => {
    if (!path) return renderPage(res, 'notfound.hbs', {});
    let video = path.content.id(videoid);
    renderPage(res, 'video-bare.hbs', {
      translucent_header: true,
      path, video
    });
  }).catch(e => res.send(e));
});

app.get('/video/:id', (req, res) => {
  let {id} = req.params;
});

module.exports = {
  renderPage
};
