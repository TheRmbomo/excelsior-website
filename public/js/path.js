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
    let link = (videoid && resource._id === videoid) ? '' : `<a href="/paths/${path}/${resource._id}">`;
    $('#showMoreRow').before(
      `<div style="padding: 0.2em;">
        - ${link}${resource.name}${link ? '</a>' : ''}
      </div>`
    );
  });
  if (res.status === 'last') $('#showMoreRow').remove();
};

(async () => {
  await ws.emit('show_more', {path, page}, show_more_res);
  $(document).on('click', '#showMore', event => {
    event.preventDefault();
    ws.emit('show_more', {path, page}, show_more_res);
  });
})();
