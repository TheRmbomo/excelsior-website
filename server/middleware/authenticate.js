const {User} = require('./../models/user');

var loggedin = (req, res, next) => {
  var token = req.cookies['x-auth'];

  User.findByToken(token).then(user => {
    if (!user) req.loggedIn = false;
    else {
      req.loggedIn = true;
      req.user = user;
      req.token = token;
    }
    next();
  }).catch(e => {
    req.loggedIn = false;
    next();
  });
};

var authenticate = (req, res, next) => {
  var token = req.cookies['x-auth'];

  User.findByToken(token).then(user => {
    if (!user) return Promise.reject('User not found');

    req.user = user;
    req.token = token;
    next();
  }).catch(e => res.status(401).send(e));
};

module.exports = {authenticate, loggedin};
