var user = {id: Array.from(_class('user'))[0].id},
id = user.id

Array.from(_class('change'), c => {
  c.addEventListener('change', event => {
    event.preventDefault()
    if (!id) return console.error('No path ID')

    let current = event.currentTarget
    let req = {id}
    req.key = current.name
    req.value = current.value
    ws.emit('edit_user', req, res => {
      if (res.error) return error_blurb(req.key, res.error)
      else _id(req.key).style.backgroundColor = ''
      if (res.redirect) window.location = res.redirect
      console.log(res)
    })
  })
})
