var socket = io();

socket.on('connect', function () {
  // console.log('Connected');

  $('#logout').on('submit', function(event) {
    event.preventDefault();

    $.ajax({
      url: "/logout",
      type: "DELETE",
      dataType: "json",
      contentType: "application/json; charset=UTF-8",
      cache: false,
      timeout: 5000
    })
    .done((res, status, xhr) => {
      // console.log(res);
      document.cookie = 'x-auth=;path=/;';
      location.reload(1);
    })
    .fail(e => console.log(e.responseText));
  });
});

socket.on('disconnect', function () {
  // console.log('Disconnected');
});
