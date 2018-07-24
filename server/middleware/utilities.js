const {app} = require('./../app')

app.use((req, res, next) => {
  req.format_date = (date, useTime) => {
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

    let newDate = `${months[month]} ${day}${suffix[day-1]}, ${year}`
    if (useTime) newDate += ` ${hours}:${minutes} ${ampm} ET`
    return newDate
  }
  next()
})
