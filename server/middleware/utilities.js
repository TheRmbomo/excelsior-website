const valid = require('validator')

const {app} = require('./../app')

var format_date = (date, useTime) => {
  for (var i=1, array=[]; array.push(i), i<31; i++);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May',
  'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  suffix = array.map(i => {
    let mod = i % 10, suffix = ['st','nd','rd']
    return (Math.floor(i/10) !== 1 && mod > 0 && mod < 4) ? suffix[mod-1] : 'th'
  }),
  date = new Date(date.getTime() - (1000 * 60 * 60 * 4)),
  month = date.getMonth(), day = date.getDate(), year = date.getFullYear(),
  hours = date.getHours(), ampm = 'AM', minutes = date.getMinutes()

  hours = (hours >= 12) ? (ampm = 'PM', hours - 12) : hours
  hours = (hours === 0) ? hours = 12 : hours
  minutes = (minutes < 10) ? `0${minutes}` : minutes

  let newDate = `${months[month]}\xa0${day}${suffix[day-1]},\xa0${year}`
  if (useTime) newDate += ` ${hours}:${minutes}\xa0${ampm}\xa0ET`
  return newDate
},
sanitize = (key, value) => {
  if (!key) return ''
  // Collapse multiple whitespace
  value = value.replace(/\s{2,}/g, ' ')
  if (valid.isIn(key, ['name', 'username'])) key = 'internal_name'
  // --

  if (valid.isIn(key, ['internal_name'])) value = value.toLowerCase()
  // Replace all whitespace with underscores
  if (valid.isIn(key, ['internal_name'])) value = value.replace(/\s+/g, '_')
  // Remove all non-word characters
  if (valid.isIn(key, ['internal_name'])) value = value.replace(/\W+/g, '')
  // Remove all numbers and underscores
  if (valid.isIn(key, ['text'])) value = value.replace(/[\d_]+/g, '')
  // Collapse multiple underscores
  if (valid.isIn(key, ['internal_name', 'display_name'])) value = value.replace(/_{2,}/g, '_')
  // Remove leading numbers, non-word characters, and underscores
  // Remove trailing underscores
  if (valid.isIn(key, ['internal_name', 'display_name'])) value = value.replace(/(^[\d\W_]+|[_]+$)/g, '')
  if (valid.isIn(key, ['internal_name', 'display_name', 'text'])) value = value.trim()

  if (valid.isIn(key, ['internal_name'])) {
    if (!value) throw {type: 'required'}
    if (!valid.isLength(value, {min: 6, max: 50})) {
      throw {type: 'length', min: 6, max: 50}
    }
  }
  if (valid.isIn(key, ['text'])) {
    if (!valid.isLength(value, {max: 50})) {
      throw {type: 'length', max: 50}
    }
  }
  if (valid.isIn(key, ['description'])) {
    if (!valid.isLength(value, {max: 1000})) {
      throw {type: 'length', max: 1000}
    }
  }

  return value
}

app.use((req, res, next) => {
  req.format_date = format_date
  req.sanitize = sanitize
  next()
})

module.exports = {
  sanitize,
  format_date
}
