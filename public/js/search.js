var socket = io();

socket.on('connect', function () {
  // console.log('Connected');
});

socket.on('disconnect', function () {
  // console.log('Disconnected');
});

$('#searchUser').on('submit', function (event) {
  event.preventDefault();
  var name = $('[name=name]').val();

  socket.emit('searchUser', name, res => {
    var div = $('#results');
    var err = $('#error-search');
    div.empty();
    err.empty();
    res.forEach(user => {
      if (user.error) err.append(`<p>${user.error}</p>`);
      else div.append(`<a href="/user/${user._id}">${user.name}</a><br>`);
    });
  });
});
