let path_edit = {}

path_edit.id = Array.from(_class('path'))[0].id

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
  if (res.display) _id('display_name').innerHTML = res.display
})

Array.from(_class('change'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    var id = path_edit.id
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
  id = path_edit.id,
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
    var id = path_edit.id
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

path_edit.mousedown = event => {
  window.addEventListener('mousemove', event.currentTarget.mousemove)
  window.addEventListener('touchmove', event.currentTarget.mousemove)
  window.addEventListener('mouseup', event.currentTarget.endDrag)
  window.addEventListener('touchend', event.currentTarget.endDrag)
}
path_edit.mousemove = element => event => {
  if (!event.touches) {
    var page = new Two.Vector(event.pageX, event.pageY)
  } else {
    var page = new Two.Vector(event.touches[0].pageX, event.touches[0].pageY)
  }
  if (!path_edit.mouse_down) {
    path_edit.mouse = page.clone()
    path_edit.mouse_down = true
    return
  }

  element.scrollLeft += path_edit.mouse.x - page.x
  path_edit.mouse = page.clone()
},
path_edit.endDrag = element => event => {
  path_edit.mouse_down = false
  window.removeEventListener('mousemove', element.mousemove)
  window.removeEventListener('touchmove', element.mousemove)
  window.removeEventListener('mouseup', element.endDrag)
  window.removeEventListener('touchend', element.endDrag)
}

path_edit.tray_scroll = x => {
  animate(duration => {
    _id('tray').scrollLeft += x/8
    if (duration < 200) return true
  })
}

_id('tray').mousemove = path_edit.mousemove(_id('tray'))
_id('tray').endDrag = path_edit.endDrag(_id('tray'))
_id('tray').addEventListener('mousedown', path_edit.mousedown)
_id('tray').addEventListener('touchstart', path_edit.mousedown)

_id('tray-left').addEventListener('mousedown', event => {
  path_edit.tray_scroll(-100)
})

_id('tray-right').addEventListener('mousedown', event => {
  path_edit.tray_scroll(100)
})

Array.from(_class('menu-option'), c => c.addEventListener('click', event => {
  Array.from(_class('menu'), c => c.style.display = 'none')
  console.dir(_id(event.currentTarget.value));
  _id(event.currentTarget.value).style.display = ''
}))
