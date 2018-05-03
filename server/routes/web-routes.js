const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {renderPage} = require('./user-routes');

app.get('/', (req, res) => {
  renderPage(res, 'home.hbs', {
    pageTitle: 'Home Page',
    welcomeMessage: 'Welcome to a website!'
  });
});

app.get('/about', (req, res) => {
  renderPage(res, 'about.hbs', {
    pageTitle: 'About Page'
  });
});

app.get('/signup', (req, res) => {
  renderPage(res, 'createUser.hbs', {
    pageTitle: 'Sign Up'
  });
});

app.get('/login', (req, res) => {
  renderPage(res, 'login.hbs', {
  });
});

app.get('/bad', (request, response) => {
  response.send({
    error_message: 'Unable to handle request'
  });
});
