var resource = {id: Array.from(_class('resource'))[0].id},
id = resource.id,
update_source_field = original => {
  console.log(original);
  if (original) {
    _id('original').style.display = ''
    _id('embed').style.display = 'none'
  } else {
    _id('original').style.display = 'none'
    _id('embed').style.display = ''
  }
},
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
    if (!id) return console.error('No resource ID')

    var current = event.currentTarget,
    req = {
      id,
      type: 'resource',
      properties: [current.name],
      values: [current.value]
    }

    if (current.name === 'source_type') {
      update_source_field(current.value === 'original')
    }

    update_model(req)
  })
})

;(function fix_onChange_editable_elements() {
  var tags = document.querySelectorAll('[contenteditable=true]')
  for (var i = tags.length - 1; i >= 0; i--) if (typeof(tags[i].onblur)!='function') {
    tags[i].onfocus = function() {
      this.data_orig = this.innerHTML
    }

    tags[i].onblur = function() {
      if (this.innerHTML != this.data_orig)
      var changeEvent = new CustomEvent('change')
      console.log(changeEvent);
      Object.assign(changeEvent, {
        changeText: this.innerHTML
      })
      this.dispatchEvent(changeEvent)
      delete this.data_orig;
    }
  }
})()

Array.from(_class('ql-editor'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No resource ID')

    var current = event.currentTarget,
    req = {
      id,
      text: event.changeText
    }

    ws.emit('update_article', req, res => {
      console.log(res);
      if (res.error) return console.error(res.error);
    })
  })
})

window.addEventListener('load', event => {
  var properties = Array.from(_class('bool')).map(key => key.id)
  properties.push('source_type')

  var req = {
    id,
    type: 'resource',
    properties
  }

  ws.emit('check_model', req, res => {
    if (!res) return
    if (res.error) return console.error(res.error);
    Object.keys(res).map(key => {
      try {
        _id(key).checked = res[key]
      } catch (e) {
        if (key === 'source_type') update_source_field(!res[key])
      }
    })
  })
}, {once: true})

Array.from(_class('bool'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No resource ID')

    var current = event.currentTarget,
    req = {
      id,
      type: 'resource',
      properties: [current.name],
      values: [current.checked]
    }

    update_model(req)
  })
})
