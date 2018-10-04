const extender = require('./extender')
const UserResponse = require('./userResponse')

module.exports = extender(UserResponse.extend({
  history: [{
    response: String,
    date: Date
  }]
}))
