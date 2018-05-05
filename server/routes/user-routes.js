const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const _ = require('lodash');

const {app} = require('./../server');
const {User} = require('./../models/user');
const {userProfile, userPrivateProfile} = require('./userProfile');
const {authenticate, loggedin} = require('./../middleware/authenticate');

app.get('/user/:id', loggedin, (req, res) => {
  var {id} = req.params;
  // Currently redirecting to home, plan on redirect to /users search form
    // with the message of 'User is not found'.
  if (!ObjectID.isValid(id)) return res.redirect('/');
  User.findById(id)
    .then(foundUser => {
      // Plan on redirect to /users with message 'User is not found'
      if (!foundUser) return res.redirect('/');
      var user = foundUser;
      userProfile(res, user);
    })
    .catch(e => {
      console.log(e);
      // Give them error message.
      res.redirect('/');
    });
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

app.get('/users/me', (req, res) => {
  userPrivateProfile(req, res, false);
});

app.get('/users/edit', loggedin, (req, res) => {
  userPrivateProfile(req, res, true);
});

app.post('/users/me', authenticate, (req, res) => {
  var subProfile = _.pick(req.body, ['name', 'bio']);
  Object.assign(req.user, subProfile);
  return req.user.save()
    .then(() => {
      // res.send({message: 'User was updated successfully'});
      res.redirect(303, '/users/me');
    }).catch(e => res.status(400).send(e));
});

app.delete('/logout', authenticate, (req, res) => {
  req.user.removeToken(req.token)
    .then(() => res.status(200).send({message: 'Successfully logged out'}))
    .catch(e => res.status(400).send(e));
});
