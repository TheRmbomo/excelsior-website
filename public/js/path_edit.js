var path = {id: Array.from(_class('path'))[0].id},
id = path.id

Array.from(_class('change'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No path ID')

    var current = event.currentTarget,
    req = {
      id,
      key: current.name,
      value: current.value
    }
    ws.emit('edit_path', req, res => {
      console.log(res);
      if (res.error) return error_blurb(req.key, res.error)
      else _id(req.key).style.backgroundColor = ''
      if (res.redirect) window.location = res.redirect
      console.log(res)
    })
  })
})

window.addEventListener('load', event => {
  var keys = Array.from(_class('booloption')).map(i => i.id.replace('show-','show_'))

  ws.emit('check_property', {type: 'path', id, keys}, res => {
    if (!res) return
    res.map(bool => {
      var key = bool.key.replace('show_','show-')
      if (bool.value) {
        _id(key).classList.add('b-yes')
        _id(key).classList.remove('b-no')
      } else {
        _id(key).classList.add('b-no')
        _id(key).classList.remove('b-yes')
      }
    })
  })
}, {once: true})

Array.from(_class('booloption'), c => {
  c.addEventListener('click', event => {
    event.preventDefault()
    let current = event.currentTarget,
    req = {
      id,
      key: current.id.replace('show-','show_'),
      value: 'toggle'
    }
    ws.emit('edit_path', req, res => {
      if (res.error) return console.error(res.error)
      if (res) {
        current.classList.add('b-yes')
        current.classList.remove('b-no')
      } else {
        current.classList.add('b-no')
        current.classList.remove('b-yes')
      }
    })
  })
})
