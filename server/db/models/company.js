const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')
const ReviewList = require('./reviewList')

const Company = new Schema({
  members: [{
    type: String,
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

Company.pre('save', function () {
  if (this.isNew) {
    let commentList = new CommentList()
    let reviewList = new ReviewList()
    this.commentList = commentList._id
    this.reviewList = reviewList._id
    commentList.save()
    reviewList.save()
  }
})

Company.post('remove', function () {
  CommentList.findById(this.commentList)
  .then(doc => doc.remove())
  ReviewList.findById(this.reviewList)
  .then(doc => doc.remove())
})

module.exports = mongoose.model('Company', Company, 'Companies')
