const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {authenticate, loggedin, defProps} = require('./../middleware/authenticate');

var renderPage = (res, link, options) => res.render(link, Object.assign(defProps, options));

app.all('*', loggedin, (req, res, next) => {
  next();
});

app.get('/', (req, res) => {
  renderPage(res, 'home.hbs', {
    pageTitle: 'Excelsior, the education and curation platform that fits you | Excelsior Industries'
  });
});

app.get('/about', (req, res) => {
  renderPage(res, 'about.hbs', {
    pageTitle: 'About Excelsior Industries'
  });
});

app.get('/signup', (req, res) => {
  renderPage(res, 'createUser.hbs', {
    pageTitle: 'Sign Up a free account | Excelsior Industries'
  });
});

app.get('/login', loggedin, (req, res) => {
  if (!req.loggedIn) renderPage(res, 'login.hbs', {pageTitle: 'Login'});
  else res.redirect('/users/me');
});

app.get('/bad', (request, response) => {
  response.send({
    error_message: 'Unable to handle request'
  });
});

module.exports = {
  renderPage
};
