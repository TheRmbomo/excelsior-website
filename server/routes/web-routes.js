const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {Path} = require('./../models/path');
const {authenticate, loggedin, defProps} = require('./../middleware/authenticate');

var renderPage = (res, link, options) => res.render(link, Object.assign({}, defProps, options));

app.all('*', loggedin, (req, res, next) => {
  next();
});

app.get('/', (req, res) => {
  renderPage(res, 'home.hbs', {
    pageTitle: 'Excelsior, the education and curation platform that fits you',
    home: true,
    action: 'Sign Up'
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
      login: true,
      action: 'Login'
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

var path = {
  id: 'testpath',
  name: 'Learn Blockchain',
  description: `Learn all the basics of blockchain programmed in JavaScript and Node.js.
   Even create your own cryptocurrency!`,
  rating: .84,
  userreviews: [
    {user: 'Paul Tokgozoglu', review: 'This is killing the game!'},
    {user: 'Hagan Pratt', review: 'Sweet'},
    {user: 'Justin Jackson', review: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed luctus et urna nec molestie. Fusce scelerisque aliquam interdum. Quisque iaculis consectetur augue, id iaculis ex pulvinar vitae. Duis ullamcorper, neque quis ullamcorper auctor, nulla sapien ornare diam, sit amet commodo ante augue porta neque. Pellentesque porttitor justo massa, eu porttitor ligula pretium ut. Donec viverra euismod aliquam. Morbi ac rhoncus ligula. Aenean luctus, magna quis varius efficitur, dolor urna consequat nulla,`},
  ],
  // content,
  content: [
    {id: '001', name: '01 Starting out', description: 'What is a blockchain?'},
    {id: '002', name: '02 Convincing', description: 'Why are they good?'}
  ]
};

app.get('/paths/:id', (req, res) => {
  var {id} = req.params;
  //var content = for each video in path.content
    // content.append(Video.findOne(video.id).then(video => _.pick(video, [name, description])).catch(e => {error: 'Video not found.'}));
  // Path.findOne(id).then(path => {
  if (id === 'testpath')
  renderPage(res, 'paths.hbs', {
    path,
    pageTitle: path.name,
    isPath: true,
    rating: `${Math.floor(path.rating*100)}%`
  });
  // }).catch(e => res.send(e));
});

app.get('/video/:id', (req, res) => {
  var {id} = req.params;
  // Video.findOne(id).then(video => {
  if (id === '001')
    var video = {
      name: 'Starting out'
    };
  else if (id == 002)
    var video = {
      name: 'Convincing'
    };
  renderPage(res, 'video.hbs', {
    videoTitle: video.name,
    translucent_header: true,
    path,
    content: path.content
  });
  // }).catch(e => res.send(e));
});

app.get('/bad', (request, response) => {
  response.send({
    error_message: 'Unable to handle request'
  });
});

module.exports = {
  renderPage
};
