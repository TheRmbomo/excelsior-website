let edit = {
  url: Array.from(_class('url'))[0].id,
  update_model: req => ws.emit('update_model', req, res => {
    if (!res) return
    if (res.error) return console.error(res)
    if (res.redirect) window.location = res.redirect.toString()
    if (res.display) _id('display_name').innerHTML = res.display
  }),
  mouse: {
    down: event => {
      window.addEventListener('mousemove', event.currentTarget.mousemove)
      window.addEventListener('touchmove', event.currentTarget.mousemove)
      window.addEventListener('mouseup', event.currentTarget.endDrag)
      window.addEventListener('touchend', event.currentTarget.endDrag)
    },
    move: element => event => {
      var page = (!event.touches ?
        new Two.Vector(event.pageX, event.pageY) :
        new Two.Vector(event.touches[0].pageX, event.touches[0].pageY)
      )
      if (!edit.mouse_isDown) {
        edit.mouseP = page.clone()
        edit.mouse_isDown = true
        return
      }

      element.scrollLeft += edit.mouseP.x - page.x
      edit.mouseP = page.clone()
    },
    up: element => event => {
      edit.mouse_isDown = false
      window.removeEventListener('mousemove', element.mousemove)
      window.removeEventListener('touchmove', element.mousemove)
      window.removeEventListener('mouseup', element.endDrag)
      window.removeEventListener('touchend', element.endDrag)
    }
  },
  tray_scroll: x => event => animate(duration => {
    _id('tray').scrollLeft += x/8
    if (duration < 200) return true
  })
}

edit.req = {
  url: edit.url,
  type: '{{{type}}}'
}

Array.from(_class('change'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()

    var current = event.currentTarget,
    req = Object.assign({
      keys: [current.name],
      values: [current.value]
    }, edit.req)

    edit.update_model(req)
  })
})

window.addEventListener('load', event => {
  var keys = Array.from(_class('bool')).map(key => key.id),
  req = Object.assign({keys}, edit.req)

  ws.emit('check_model', req, res => {
    if (!res) return
    if (res.error) return console.error(res)
    Object.keys(res).map(key => _id(key).checked = res[key])
  })
}, {once: true})

Array.from(_class('bool'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()

    var current = event.currentTarget,
    req = Object.assign({
      keys: [current.name],
      values: [current.checked]
    }, edit.req)

    edit.update_model(req)
  })
})

_id('tray').mousemove = edit.mouse.move(_id('tray'))
_id('tray').endDrag = edit.mouse.up(_id('tray'))
_id('tray').addEventListener('mousedown', edit.mouse.down)
_id('tray').addEventListener('touchstart', edit.mouse.down)

_id('tray-left').addEventListener('mousedown', edit.tray_scroll(-100))
_id('tray-right').addEventListener('mousedown', edit.tray_scroll(100))

Array.from(_class('menu-option'), c => c.addEventListener('click', event => {
  Array.from(_class('menu'), c => c.classList.add('hidden'))
  _id(event.currentTarget.value).classList.remove('hidden')
}))

_id('delete').addEventListener('click', () => {
  var req = new XMLHttpRequest()
  req.open("DELETE", window.location.origin + '/{{{type2}}}/' + edit.url + '/delete')
  req.send()
  req.onreadystatechange = ()=>{if (req.readyState === 4) console.log(req.status, req.response)}
  window.location = '/'
})

;(function fix_onChange_editable_elements() {
  var tags = document.querySelectorAll('[contenteditable=true]')
  for (var i = tags.length - 1; i >= 0; i--) if (typeof(tags[i].onblur)!='function') {
    tags[i].onfocus = function() {this.data_orig = this.innerHTML}
    tags[i].onblur = function() {
      if (this.innerHTML != this.data_orig)
      var changeEvent = new CustomEvent('change')
      Object.assign(changeEvent, {changeText: this.innerHTML})
      this.dispatchEvent(changeEvent)
      delete this.data_orig;
    }
  }
})()

Array.from(_class('ql-editor'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()

    var current = event.currentTarget,
    req = Object.assign({text: event.changeText}, edit.req)

    ws.emit('update_article', req, res => {
      console.log(res);
      if (res.error) return console.error(res.error);
    })
  })
})
