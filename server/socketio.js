const http = require('http');
const socketIO = require('socket.io');

const {app} = require('./server');
const {User} = require('./models/user');

const port = process.env.PORT || 80;
var server = http.createServer(app);
var io = socketIO(server);

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

server.listen(port, '0.0.0.0', undefined, () => {
  console.log(`Server is up on port ${port}`);
});
