var socket = io();

socket.on('connect', () => {
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
      $(location).attr("href", "/users/me");
    })
    .fail(e => {
      console.log(e);
      if (e.responseJSON.error) $('#error-signin').html(`${e.responseJSON.error}`);
    });
  });
});

socket.on('disconnect', () => {
});
