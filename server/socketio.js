const http = require('http');
// const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');

const {app} = require('./server');
const {User} = require('./models/user');
const httpPort = 3000;

var httpServer = http.createServer(app);

var io = socketIO(httpServer);

io.on('connection', socket => {
  socket.on('searchUser', (name, send) => {
    // send is callback, sends back to client
    if (!name) return send([{error: 'Please enter a name.'}]);
    User.find({name: new RegExp('^'+name, 'i')})
      .then(users => send(users))
      .catch(e => console.log(e));
  });

  socket.on('disconnect', () => {
  });
});

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Http server is up on port ${httpPort}`));
