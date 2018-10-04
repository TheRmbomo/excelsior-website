const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TrackedResponse = require('./trackedResponse')

const Comment = new Schema(TrackedResponse.extend({
  list: {
    type: Schema.Types.ObjectId,
    ref: 'CommentList',
    required: true
  },
  replied_to: {
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }
}))

module.exports = mongoose.model('Comment', Comment, 'Comments')
