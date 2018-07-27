const WebSocket = require('ws');
const cookie = require('cookie');
const valid = require('validator');

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
});

ws.validateString = (string, path) => {
  let error = {};
  let minlength = 6;
  if (!string) {
    error[path] = {path, kind: 'required'};
  } else if (!valid.isLength(string, {min: minlength})) {
    error[path] = {path, kind: 'minlength', properties: {minlength}};
  }
  if (Object.keys(error).length) return {error};
  let result = valid.escape(string);
  return result;
};

ws.validateURL = url => {
  if (!url) return {error: {url: {path: 'url', kind: 'required'}}};
  else if (!valid.isURL(url)) return {error: {url: {path: 'url', kind: 'invalid'}}};
  let result = url
  .replace('watch?v=', 'embed/')
  .replace('&feature=em-uploademail', '');
  return result;
};

ws.on('connection', (socket, req) => {
  socket.events = {};
  socket._on = socket.on;
  socket.emitu = function (event, data) {
    if (typeof event !== 'string') return;

    let req = {event};
    if (data) req.data = data;

    let res = this.send(JSON.stringify(req));
  };
  socket.on = function (event, callback) {
    if (typeof event !== 'string' || typeof callback !== 'function') return;
    this._on('message', req => {
      req = JSON.parse(req);
      if (req.event !== event) return;

      let socket = this, done = false;
      let res_callback = (req.hasCallback !== undefined) ? function () {
        if (done) return console.error('Callback already sent');
        let args = Array.prototype.map.call(arguments, arg => arg);
        socket.emitu(`callback-${event}`, {event, message: 'three', args});
        done = true;
      } : () => console.error('No callback provided');
      res_callback = res_callback.bind(res_callback);
      callback(req.data, res_callback);
    });
  };
  socket.cookies = (req.headers.cookie) ? cookie.parse(req.headers.cookie) : undefined;
});

module.exports = ws;
