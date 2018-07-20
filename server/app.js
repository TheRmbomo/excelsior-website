require('./config/config');

const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const passport = require('passport');
// const fs = require('fs');

var app = express()
.set('views', path.join(__dirname + '/views'))
// .use(express.json())
// .use(express.urlencoded({extended: true}))
.use(session({
  store: new RedisStore({
    port: 6379,
    host: 'www.excelsiorindustries.com',
    pass: process.env.REDIS
  }),
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: false
  }
}))
.use((req, res, next) => {
  req.format_date = (date, useTime) => {
    for (var i=1, array=[]; array.push(i), i<31; i++);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May',
    'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    suffix = array.map(i => {
      let mod = i % 10, suffix = ['st','nd','rd'];
      return (Math.floor(i/10) !== 1 && mod > 0 && mod < 4) ? suffix[mod-1] : 'th';
    });
    date = `${months[date.getMonth()]} ${date.getDate()}${suffix[date.getDate()-1]},
    ${date.getFullYear()}${(useTime) ? ` ${date.getHours()}` : ''}`;
    return date;
  }
  next()
})

const httpPort = 3000;
var httpServer = http.createServer(app);

module.exports = {app, httpServer};
require('./routes/public-routes');
require('./middleware/passport');
require('./middleware/handlebars.js');

// require('./db/mongoose');
require('./db/pg');

Object.assign(app.locals, {
  title: '',
  navigation: true,
  absolutePath: path.join(__dirname, '..')
});

require('./routes/web-routes');
require('./routes/user-routes');
// require('./routes/search-routes');
// require('./websockets');
// require('./routes/chatbot-routes');

app.get('/not-found', (req, res) => {
  res.render('misc/not_found', {
    title: 'Resource not found'
  });
});

app.all('*', (req, res) => {
  res.redirect('/not-found');
});

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Http server is up on port ${httpPort}`));
