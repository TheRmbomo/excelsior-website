const {User} = require('./../models/user');
const defProps = {};

var loggedin = (req, res, next) => {
  var token = req.cookies['x-auth'];

  User.findByToken(token).then(user => {
    if (!user) req.loggedIn = false;
    else {
      req.loggedIn = true;
      req.user = user;
      req.token = token;
    }
  }).catch(e => {
    req.loggedIn = false;
  }).then(() => {
    Object.assign(defProps, {
      pageTitle: '',
      loggedIn: req.loggedIn,
      navigation: true
    });
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
  }).catch(e => res.status(401).send({e}));
};

module.exports = {authenticate, loggedin, defProps};
