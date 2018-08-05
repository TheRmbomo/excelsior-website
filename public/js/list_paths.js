Array.from(_class('follow'), c => {
  let id
  c.addEventListener('click', event => {
    event.preventDefault()
    let follow = event.currentTarget, row = getParents(5, event.currentTarget)
    id = row.id
    if (!id) return console.log('No path ID')
    ws.emit('follow_path', {id}, res => {
      if (res.error) return console.log(res.error)
      if (res.state) {
        follow.classList.add('green','background')
        follow.innerHTML = 'Following'
      } else {
        follow.classList.remove('green','background')
        follow.innerHTML = 'Follow'
      }
    })
  })
})
