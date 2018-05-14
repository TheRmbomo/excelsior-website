const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {authenticate, loggedin, defProps} = require('./../middleware/authenticate');
const {renderPage} = require('./web-routes');

app.get('/search', (req, res) => {
  res.redirect('/search/paths');
});

app.get('/search/paths', (req, res) => {
  renderPage(res, 'searchPage.hbs', {
    pageTitle: 'Search Paths',
    type: 'paths'
  });
});

app.get('/search/resources', (req, res) => {
  renderPage(res, 'searchPage.hbs', {
    pageTitle: 'Search Resources',
    type: 'resources'
  });
});

app.get('/search/users', (req, res) => {
  renderPage(res, 'searchPage.hbs', {
    pageTitle: 'Search Users',
    type: 'users'
  });
});
