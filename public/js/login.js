var socket = io();

socket.on('connect', () => {
  console.log('Hello');
});

socket.on('disconnect', () => {
});

$('#signin').on('submit', event => {
  event.preventDefault();
  var authInfo = JSON.stringify({
    email: $('[name=email]').val(),
    password: $('[name=password]').val()
  });

  var http = new XMLHttpRequest();
  http.open('POST', '/login');
  http.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

  http.onreadystatechange = () => {
    var res = http.responseText;
    if (res && http.readyState == 4) {
      if (http.status == 200) return location.href = '/';
      $('#error-box').html(JSON.parse(res).error);
    }
  };

  http.send(authInfo);
  // $.ajax({
  //   url: "/login",
  //   type: "POST",
  //   dataType: "json",
  //   data: authInfo,
  //   contentType: ,
  //   xhrFields: {
  //     withCredentials: true
  //   },
  //   crossDomain: true,
  //   timeout: 5000
  // })
  // .done((res, status, xhr) => {
  //   // console.log(JSON.stringify(xhr, undefined, 2));
  //   location.href = "/";
  // })
  // .fail(err => {
  //   var {error} = err.responseJSON;
  //   console.log(err);
  //   $('#error-box').html(error);
  // });
});
