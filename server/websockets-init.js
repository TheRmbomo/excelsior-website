const WebSocket = require('ws')
const cookie = require('cookie')
const valid = require('validator')
const {redisClient} = require('./middleware/passport')

var ws = new WebSocket.Server({
  port: 3002,
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

ws.validateString = (string, path) => {
  let error = {}
  let minlength = 6
  if (!string) {
    error[path] = {path, kind: 'required'}
  } else if (!valid.isLength(string, {min: minlength})) {
    error[path] = {path, kind: 'minlength', properties: {minlength}}
  }
  if (Object.keys(error).length) return {error}
  let result = valid.escape(string)
  return result
}

ws.validateURL = url => {
  if (!url) return {error: {url: {path: 'url', kind: 'required'}}}
  else if (!valid.isURL(url)) return {error: {url: {path: 'url', kind: 'invalid'}}}
  let result = url
  .replace('watch?v=', 'embed/')
  .replace('&feature=em-uploademail', '')
  return result
}

ws.on('connection', async (socket, req) => {
  socket.events = {}
  socket._on = socket.on
  socket._send = socket.send
  socket.send = function (event, data) {
    if (typeof event !== 'string') return

    let req = {event}
    if (data) req.data = data

    let res = this._send(JSON.stringify(req))
  }

  socket._on('message', req => {
    try {
      if (req === 'ping') return socket._send(`pong`)
      req = JSON.parse(req)
    } catch (e) {return}
    if (!socket.events[req.event]) return

    let done = false,
    callback = (req.callback !== undefined) ? (function () {
      if (done) return console.error('Callback already sent')
      let args = Array.from(arguments)
      socket.send(`callback-${req.event}`, {event: req.event, args})
      done = true
    }) : () => {}
    socket.events[req.event](req.data, callback)
  })

  socket.on = function (event, callback) {
    if (typeof event !== 'string' || typeof callback !== 'function') return
    if (socket.events[event]) return console.log(`Event already defined: ${event}`)
    socket.events[event] = callback
  }

  socket.cookies = (req.headers.cookie) ? cookie.parse(req.headers.cookie) : undefined
  let sessionCookie = (socket.cookies && socket.cookies['connect.sid']) ?
    socket.cookies['connect.sid'].slice(2).split('.')[0] : null
  socket.user = null
  if (sessionCookie) {
    socket.session = await new Promise(resolve => redisClient.get(sessionCookie, (err, ses) => resolve(ses.passport)))
    if (socket.session.user) socket.user = {id: socket.session.user}
  }

  ws.emit('ready', socket, req)
})

module.exports = ws
