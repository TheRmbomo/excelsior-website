const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Resource = new Schema({
  description: {
    type: String,
    trim: true,
    default: ''
  },
  comments: {
    type: Schema.Types.ObjectId,
    ref: 'CommentList'
  },
  views: Number,
  rating: {
    likes: Number,
    dislikes: Number
  },
  source: String
})

module.exports = mongoose.model('Resource', Resource, 'Resources')
