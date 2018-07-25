const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserResponse = require('./userResponse')

const Comment = new Schema({
  history: [{
    response: String,
    date: Date
  }],
  replied_to: {
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }
})

module.exports = UserResponse.discriminator('Comment', Comment, 'Comments')
