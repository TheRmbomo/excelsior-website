const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserResponse = new Schema({
  author: {
    type: String,
    ref: 'User',
    required: true
  },
  response: {
    type: String,
    trim: true,
    minlength: 6,
    required: true
  }
})

module.exports = mongoose.model('UserResponse', UserResponse, 'UserResponses')
