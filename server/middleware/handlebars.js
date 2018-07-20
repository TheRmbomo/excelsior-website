const hbs = require('hbs')
const path = require('path')

const {app} = require('./../server')
app.set('view engine', 'hbs')

hbs.registerPartials(path.join(__dirname + './../views/partials'))

hbs.registerHelper('getCurrentYear', () => {
  return new Date().getFullYear()
})
