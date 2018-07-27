const valid = require('validator');

const ws = require('./websockets-init');

ws.on('connection', socket => {
  socket.on('show_more', (req, send) => {
  });
});
