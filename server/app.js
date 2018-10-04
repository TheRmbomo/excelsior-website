require('./config/config')

const path = require('path')
const http = require('http')
const fs = require('fs')
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
})

var errorlog = e => {
  var log = process.env.ERROR_LOG,
  stack = e.stack ? e.stack : Error(e).stack
  if (log) fs.appendFile(path.join(app.locals.absoluteDir, log), stack + '\n', err => {
    if (err) console.log(Error(err))
  })
}

module.exports = {app, httpServer, errorlog}
require('./routes/public-routes')
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
require('./routes/path-routes')
require('./routes/resource-routes')
require('./routes/user-routes')
// require('./routes/search-routes');
require('./routes/chatbot-routes');
// --

// Default Routes
app.get('/not-found', (req, res) => {
  res.status(404).render('misc/not_found', {
    title: 'Resource not found'
  })
})
.use((err, req, res, next) => {
  if (err === 'nf') return res.status(400).redirect('/not-found')
  if (err === 'auth') return res.status(401).redirect('/login')
  else if (err) {
    errorlog(err)
    return res.status(500).render('error')
  }
  return next()
})
.all('*', (req, res) => res.status(404).redirect('/not-found'))
// --

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Http server is up on port ${httpPort}`))
