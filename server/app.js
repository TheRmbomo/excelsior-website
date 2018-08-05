require('./config/config')

const path = require('path')
const http = require('http')
const express = require('express')
const passport = require('passport')

// Server Initialization
var app = express()
.set('views', path.join(__dirname + '/views'))
var httpServer = http.createServer(app)
const httpPort = 3000

Object.assign(app.locals, {
  title: '',
  navigation: true,
  absoluteDir: path.join(__dirname, '..'),
  absolutePath: 'localhost:3001'
})

module.exports = {app, httpServer}
require('./routes/public-routes')
require('./test')
// --

// Middleware
require('./middleware/utilities')
require('./middleware/passport')
require('./middleware/handlebars')
// --

// Databases
require('./db/mongoose')
require('./db/pg')
// --

require('./websockets')
// Routes
require('./routes/web-routes')
require('./routes/user-routes')
// require('./routes/search-routes');
// require('./routes/chatbot-routes');
// --

// Default Routes
app.get('/not-found', (req, res) => {
  res.status(404).render('misc/not_found', {
    title: 'Resource not found'
  })
})
.use((err, req, res, next) => {
  if (err === 'nf') return res.redirect('/not-found')
  next(err)
})
.all('*', (req, res) => {
  res.redirect('/not-found')
})
// --

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Http server is up on port ${httpPort}`))
