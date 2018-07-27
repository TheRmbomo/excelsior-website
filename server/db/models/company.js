const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Company = new Schema({
  members: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  description: {
    type: String,
    trim: true
  },
  available_to_clients: Boolean,
  location: String,
  commentList: {
    type: Schema.Types.ObjectId,
    ref: 'CommentList'
  },
  reviewList: {
    type: Schema.Types.ObjectId,
    ref: 'ReviewList'
  }
})

module.exports = mongoose.model('Company', Company, 'Companies')
