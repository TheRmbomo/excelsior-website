var verify_signup = current => {
  email = _id('email'),
  password = _id('password'),
  confirm = _id('confirm_password'),
  display = _id('display_name'),
  agree = _id('agree'),
  email_regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

  var good_email = email.value && email_regex.test(email.value),
  good_password = password.value && (password.value.length >= 6 && password.value.length <= 512),
  matching_password = password.value === confirm.value,
  has_display = !!display.value,
  agreed = agree.checked

  if (!current.value) {
    error_blurb({[current.id]: {type: 'required'}})
  } else if (current.id === 'email' && !good_email) {
    error_blurb({[email.id]: {type: 'invalid'}})
  } else if (current.id === 'password' && !good_password) {
    error_blurb({[password.id]: {type: 'length', min: 6, max: 512}})
  } else if (current.id === 'confirm_password' && !matching_password) {
    error_blurb({[confirm.id]: {type: 'matching'}})
  }
  else current.style.backgroundColor = ''

  if (good_email && good_password && matching_password && has_display && agreed) {
    _id('submit').disabled = false
  } else _id('submit').disabled = true
}

[_id('email'),_id('password'),_id('confirm_password'),_id('display_name'),_id('agree')]
.map(c => {
  c.addEventListener('blur', event => {
    event.preventDefault()
    verify_signup(event.currentTarget)
  })
})

_id('agree').addEventListener('change', event => {
  event.preventDefault()
  verify_signup(event.currentTarget)
})
