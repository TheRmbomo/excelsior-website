var socket = io();

var page = 0;
var path = location.pathname.split('/')[2];
var videoid = location.pathname.split('/')[3];

var show_more_res = res => {
  if (res.error) {
    console.log(res.error);
    return $('#showMoreRow').remove();
  }
  page = res.page;
  if (page === undefined) return $('#showMoreRow').remove();
  res.content.map(resource => {
    if (videoid && resource._id === videoid) $('#showMoreRow').before(
      `<tr>
        <td class="atop">-</td>
        <td colspan=15>${resource.name}</td>
      </tr>`
    );
    else $('#showMoreRow').before(
      `<tr>
        <td class="atop">-</td>
        <td colspan=15><a href="/paths/${path}/${resource._id}">${resource.name}</a></td>
      </tr>`
    );
  });
  if (res.status === 'last') $('#showMoreRow').remove();
};

socket.on('connect', function () {
  // console.log('Connected');
  socket.emit('show_more', {path, page}, show_more_res);
  $(document).on('click', '#showMore', event => {
    event.preventDefault();
    socket.emit('show_more', {path, page}, show_more_res);
  });
});

socket.on('disconnect', function () {
  // console.log('Disconnected');
});
