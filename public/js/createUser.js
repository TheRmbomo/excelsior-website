var socket = io();

socket.on('connect', function () {
});

socket.on('disconnect', function () {
});

$('#signup').on('submit', function (event) {
  event.preventDefault();
  var authInfo = JSON.stringify({
    email: $('[name=email]').val(),
    password: $('[name=password]').val()
  });

  $.ajax({
    url: "/signup",
    type: "POST",
    dataType: "json",
    data: authInfo,
    contentType: "application/json; charset=UTF-8",
    timeout: 5000
  })
  .done((res, status, xhr) => {
    // console.log(res);
    var token = xhr.getResponseHeader('x-auth');
    document.cookie = 'x-auth=' + token + ';path=/;HttpOnly;';
    $(location).attr("href", "/users/me");
  })
  .fail(e => console.log(e.responseText));
});
