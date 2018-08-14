var path = {id: Array.from(_class('path'))[0].id},
id = path.id,
update_model = req => ws.emit('update_model', req, res => {
  try {
    if (res.error) {
      try {
        res.error.map(error => error_blurb(error))
      } catch (e) {
        return console.error(res.error);
      }
    }
    else req.properties.map(id => _id(id).style.backgroundColor = '')
  } catch (e) {}
  if (res.redirect) window.location = res.redirect
  if (res.display) _id('display').innerHTML = res.display
})

Array.from(_class('change'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No path ID')

    var current = event.currentTarget,
    req = {
      id,
      type: 'path',
      properties: [current.name],
      values: [current.value]
    }

    update_model(req)
  })
})

window.addEventListener('load', event => {
  var keys = Array.from(_class('bool')),
  req = {
    id,
    type: 'path',
    properties: keys.map(key => key.id)
  }

  ws.emit('check_model', req, res => {
    if (!res) return
    if (res.error) return console.error(res.error);
    Object.keys(res).map(key => {
      _id(key).checked = res[key]
    })
  })
}, {once: true})

Array.from(_class('bool'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No path ID')

    var current = event.currentTarget,
    req = {
      id,
      type: 'path',
      properties: [current.name],
      values: [current.checked]
    }

    update_model(req)
  })
})
