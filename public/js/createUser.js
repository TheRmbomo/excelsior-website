var socket = io();

var clearbox = box => box.css('background-color', '');

var redbox = box => {
  var rgb = box.css('background-color').replace(/[^\d,]/g, '').split(',');
  var red = parseInt(rgb[0]),
      green = parseInt(rgb[1]),
      blue = parseInt(rgb[2]);
  var i = setInterval(() => {
    red += 16;
    if (blue > 15) blue -= 16;
    if (green > 15) green -= 16;
    box.css({'background-color': `rgb(${red}, ${green}, ${blue})`});
    if (red >= 160) {
      setTimeout(() => clearbox(box), 100);
      return clearInterval(i);
    }
  }, 10);
};

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
      if (e.responseJSON.error) $('#error-signin').html(`${e.responseJSON.error}`)
      else if (e.responseJSON.errors) {
        var {errors} = e.responseJSON;
        $('#error-signin').html('');
        Object.keys(errors).forEach(key => {
          if (key === 'email') redbox($('#email'));
          if (key === 'password') redbox($('#password'));
          if (key === 'email') $('#error-signin').append('<p class="unset box">Invalid email</p>');
          if (key === 'password') $('#error-signin').append('<p class="unset box">Invalid password</p>');
        });
      }
      else if (e.responseJSON.code) $('#error-signin').html('A user with that email already exists');
    });
  });
});

socket.on('disconnect', () => {
});
