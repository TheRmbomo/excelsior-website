const extender = require('./extender')

module.exports = extender({
  author: {
    type: String,
    ref: 'User',
    required: true
  },
  response: {
    type: String,
    trim: true,
    required: true
  }
})
