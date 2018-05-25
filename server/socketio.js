const http = require('http');
const fs = require('fs');
const socketIO = require('socket.io');

const {app} = require('./server');
const {User} = require('./models/user');
const {Path} = require('./models/path');
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

  socket.on('show_more', (req, send) => {
    let content = [];
    let page = req.page;
    let status = 'next';
    Path.findById(req.path).then(path => {
      if (!path) send({status: 'last'});
      let first = 10*page, last = first + 9;
      page++;
      for (let i=first; i<last; i++) {
        if (i === path.content.length) {
          status = 'last';
          break;
        }
        content.push(path.content[i]);
      }
      send({status, page, content});
    }).catch(error => send({error}));
  });

  socket.on('disconnect', () => {
  });
});

httpServer.listen(httpPort, '0.0.0.0', undefined, () => console.log(`Http server is up on port ${httpPort}`));
