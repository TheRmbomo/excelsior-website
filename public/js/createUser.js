var socket = io();

socket.on('connect', function () {
});

socket.on('disconnect', function () {
});

$('#signin').on('submit', function (event) {
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
    xhrFields: {
      withCredentials: true
    },
    timeout: 5000
  })
  .done((res, status, xhr) => {
    // console.log(res);
    var token = xhr.getResponseHeader('x-auth');
    var domain = '.localhost';
    // document.cookie = `x-auth=${token};path=/;domain=${domain};HttpOnly;`;
    // console.log(document.cookie, `x-auth=${token};path=/;domain=${domain};HttpOnly;`);
    $(location).attr("href", "/users/me");
  })
  .fail(e => console.log(e.responseText));
});
