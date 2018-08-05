var path = {id: Array.from(_class('path'))[0].id},
id = path.id

Array.from(_class('change'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No path ID')

    let current = event.currentTarget
    let req = {id}
    req.key = current.name
    req.value = current.value
    ws.emit('edit_path', req, res => {
      if (res.error) return console.error(res.error)
      if (res.redirect) window.location = res.redirect
      console.log(res);
    })
  })
})
