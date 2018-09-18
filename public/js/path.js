let p = {
  logged_in: _id('logged_in').innerText === 'true',
  pathURL: _id('pathURL').innerText,
  comment_box: _id('pathcomment-field'),
  send_comment: _id('pathcomment-send'),
  follow: _id('follow')
}

p.send_comment.disabled = true
p.send_comment.classList.remove('light', 'background')
if (!p.logged_in) {
  let logIn = document.createElement('div'),
  logInText = document.createTextNode('Log in to comment. '),
  logInLink = document.createElement('a'),
  logInLinkText = document.createTextNode('Click here')
  logIn.appendChild(logInText)
  logIn.appendChild(logInLink)
  logInLink.appendChild(logInLinkText)
  logIn.classList.add(...p.comment_box.classList)
  logIn.classList.add('round')
  logInLink.href = `/login?page=${p.pathURL}`
  logInLink.id = 'loginlink'
  p.comment_box.parentNode.parentNode.insertBefore(logIn, p.comment_box.parentNode)
  p.comment_box.parentNode.parentNode.removeChild(p.comment_box.parentNode)
}
else {
  animate(() => {
    if (p.comment_box.value) {
      p.send_comment.disabled = false
      p.send_comment.classList.add('light', 'background')
    }
    else {
      p.send_comment.disabled = true
      p.send_comment.classList.remove('light', 'background')
    }
    return true
  })
}

p.send_comment.addEventListener('click', event => {
  var text = p.comment_box.value
  if (!text) return
  ws.emit('make_comment', {url: p.pathURL, text} , res => {
    if (res.error) return console.error(res)
    
    p.comment_box.value = ''
    console.log(res);
  })
})

p.follow.addEventListener('click', event => {
  if (!p.pathURL) return console.error('No path URL')
  var follow = event.currentTarget
  ws.emit('follow_path', {url: p.pathURL}, res => {
    if (res.error) return console.error(res)
    if (res.state) {
      follow.classList.add('green','background')
      follow.innerHTML = 'Following'
    }
    else {
      follow.classList.remove('green','background')
      follow.innerHTML = 'Follow'
    }
  })
})

ws.emit('is_following', {url: p.pathURL}, res => {
  if (!res) return
  p.follow.classList.add('green','background')
  p.follow.innerHTML = 'Following'
})
