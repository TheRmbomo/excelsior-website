const path = require('path')
const hbs = require('hbs')

const {app} = require('./../app')
app.set('view engine', 'hbs')
.use((req, res, next) => {
  res._render = res.render
  res.render = function (file, options) {
    if (!options) options = {}
    file = file.replace('.hbs','')
    res._render('../template.hbs', Object.assign(options, {
      partial: () => file
    }))
  }
  next()
})

hbs.registerPartials(path.join(__dirname + './../views/partials'))
hbs.registerPartials(path.join(__dirname + '/../views'))

hbs.registerHelper('getCurrentYear', () => {
  return new Date().getFullYear()
})
