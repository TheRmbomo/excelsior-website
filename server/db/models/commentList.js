const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = new Schema({
  comments: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }]
})

module.exports = mongoose.model('CommentList', CommentList, 'CommentLists')
