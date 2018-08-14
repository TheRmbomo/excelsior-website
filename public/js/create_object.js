_id('display_name').addEventListener('blur', event => {
  event.preventDefault()
  var current = event.currentTarget

  if (!current.value) {
    error_blurb({[current.id]: {type: 'required'}})
    _id('submit').disabled = true
  } else {
    _id('submit').disabled = false
    current.style.backgroundColor = ''
  }
})
