const fs = require('fs')
const express = require('express')
const valid = require('validator')
const hbs = require('hbs')

const {app, errorlog} = require('./../app')
const properties = require('./../json/client_js.json')

var js = express.Router()
app.use('/js', (req, res, next) => next(), js)

js.get('/', (req, res) => res.send('Yes'))

js.get('/edit.js', (req, res) => {
  if (!req.query.type) return res.send('console.error(\'Type required\')')
  var typeSettings = properties[req.query.type]
  if (!typeSettings) return res.send('console.error(\'Invalid type\')')
  var path = app.locals.absoluteDir + '/server/client_js',
  stream = fs.createReadStream(path + '/edit.js'),
  ss = string => new hbs.SafeString(string),
  type2 = properties[req.query.type].type2 || req.query.type,
  opt = {
    type: ss(req.query.type),
    type2: ss(type2)
  }
  stream.on('data', chunk => res.write(hbs.compile(chunk.toString())(opt)))
  stream.on('end', () => res.end())
})
