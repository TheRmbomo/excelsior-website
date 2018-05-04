const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {User} = require('./../models/user');
const {authenticate, loggedin} = require('./../middleware/authenticate');

var findUser = email => User.find({email: new RegExp('^'+email, 'i')});

var defProps = {};
var renderPage = (res, link, options) => res.render(link, Object.assign(defProps, options));

app.all('*', loggedin, (req, res, next) => {
  app.set('defProps', {
    loggedIn: req.loggedIn,
    navigation: true
  });
  defProps = app.get('defProps')
  next();
});

app.post('/signup', (req, res) => {
  var user = new User(_.pick(req.body, ['email', 'password']));

  user.save()
    .then(() => user.generateAuthToken())
    .then(token => res.header('x-auth', token).send(user))
    .catch(e => res.status(400).send(e));
});

app.post('/login', (req, res) => {
  var {email, password} = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(email, password)
    .then(user => {
      return user.generateAuthToken()
        .then(token => res.set('x-auth', token).send(user));
    })
    .catch(e => {
      res.status(401);
      if (e) return res.send(e);
      var e = {};
      if (!email || !password) e.message = 'Required field is missing';
      res.send(e);
    });
});

app.get('/users/me', loggedin, (req, res) => {
  if (req.loggedIn) renderPage(res, 'userProfile.hbs', {
    pageTitle: (req.user.name || req.user.email)
  });
  else res.redirect('/login');
});

app.delete('/logout', authenticate, (req, res) => {
  req.user.removeToken(req.token)
    .then(() => res.status(200).send({message: 'Successfully logged out'}))
    .catch(e => res.status(400).send(e));
});

module.exports = {
  findUser, renderPage
};
