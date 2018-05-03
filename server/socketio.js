const http = require('http');
const socketIO = require('socket.io');

const {app} = require('./server');
const userRoutes = require('./routes/user-routes');

const port = process.env.PORT || 80;
var server = http.createServer(app);
var io = socketIO(server);

io.on('connection', socket => {

  socket.on('searchUser', (email, send) => {
    // send is callback, sends back to client
    if (!email) send([{email: 'Please enter a name.'}]);
    userRoutes.findUser(email)
      .then(users => send(users))
      .catch(e => console.log(e));
  });

  socket.on('disconnect', () => {
  });
});

server.listen(port, '0.0.0.0', undefined, () => {
  console.log(`Server is up on port ${port}`);
});
