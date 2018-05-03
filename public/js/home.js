var socket = io();

socket.on('connect', function () {
  // console.log('Connected');
});

socket.on('disconnect', function () {
  // console.log('Disconnected');
});

$('#searchUser').on('submit', function (event) {
  event.preventDefault();
  var email = $('[name=email]').val();

  socket.emit('searchUser', email, function (res) {
    var div = $('#results');
    div.empty();
    res.forEach(el => {
      div.append(`<div>${el.email}</div>`);
    });
  });
});
