require('./config/config');

const path = require('path');
const http = require('http');
const express = require('express');
const passport = require('passport');

// Server Initialization
var app = express()
.set('views', path.join(__dirname + '/views'))
var httpServer = http.createServer(app);
const httpPort = 3000;

Object.assign(app.locals, {
  title: '',
  navigation: true,
  absoluteDir: path.join(__dirname, '..'),
  absolutePath: 'localhost:3001'
});

module.exports = {app, httpServer};
require('./routes/public-routes');
// --

// Middleware
require('./middleware/utilities');
require('./middleware/passport');
require('./middleware/handlebars');
// --

// Databases
require('./db/pg');
// --

// Routes
require('./routes/web-routes');
require('./routes/user-routes');
// require('./routes/search-routes');
// require('./websockets');
// require('./routes/chatbot-routes');
// --

// Default Routes
app.all('*', (req, res) => {
  res.redirect('/not-found');
});

app.get('/not-found', (req, res) => {
  res.render('misc/not_found', {
    title: 'Resource not found'
  });
});
// --

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Http server is up on port ${httpPort}`));
