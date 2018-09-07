const WebSocket = require('ws')
const cookie = require('cookie')
const valid = require('validator')
const {httpServer} = require('./app')
const {pgQuery} = require('./db/pg')
const {redisClient} = require('./middleware/passport')

var ws = new WebSocket.Server({
  server: httpServer,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    clientMaxWindowBits: 10,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  }
})

ws.on('connection', (socket, req) => {
  socket.events = {}
  socket._on = socket.on
  socket._send = socket.send
  socket.send = function (event, data) {
    if (typeof event !== 'string') return

    var req = {event}
    if (data) req.data = data

    if (this.readyState === 1) this._send(JSON.stringify(req))
  }

  socket._on('message', req => {
    try {
      if (req === 'ping') return socket._send(`pong`)
      req = JSON.parse(req)
    } catch (e) {return}
    if (!socket.events[req.event]) return

    var done = false,
    callback = (req.callback !== undefined) ? (function () {
      if (done) return console.error('Callback already sent')
      var args = Array.from(arguments)
      socket.send(`callback-${req.event}`, {event: req.event, args})
      done = true
    }) : () => {}
    socket.events[req.event](req.data, callback)
    try {
      socket.session.save()
      .catch(e => e)
    } catch (e) {e}
  })

  socket.on = function (event, callback) {
    if (typeof event !== 'string' || typeof callback !== 'function') return
    if (socket.events[event]) return console.log(`Event already defined: ${event}`)
    socket.events[event] = callback
  }

  try {
    socket.cookies = cookie.parse(req.headers.cookie)
    socket.sessionID = socket.cookies['connect.sid'].slice(2).split('.')[0]
  } catch (e) {}
  socket.session = null

  var promise = Promise.resolve()
  if (socket.sessionID) {
    promise = promise.then(() => {
      return new Promise((resolve, reject) => redisClient.get(socket.sessionID, (err, session) => {
        if (err) return reject(err)
        resolve(session)
      }))
      .then(session => {
        if (!session) throw 'No session'
        session.save = () => new Promise((resolve, reject) => {
          redisClient.set(socket.sessionID, session, err => {
            if (err) reject(err)
            resolve()
          })
        })
        socket.session = session
        socket.user = {id: socket.session.passport.user}
        return pgQuery(`SELECT username, shortened_id FROM users WHERE id=$1`, [socket.user.id])
        .then(q => q.rows[0])
        .then(user => {
          socket.user.name = user.username
          socket.user.shortened_id = user.shortened_id.toString('hex')
        })
      })
    })
  }

  promise.then(() => ws.emit('ready', socket, req))
  .catch(e => e)
})

module.exports = ws
