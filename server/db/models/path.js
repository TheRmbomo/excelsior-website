const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')
const ReviewList = require('./reviewList')

const Path = new Schema({
  description: {
    type: String,
    trim: true,
    default: ''
  },
  commentList: {
    type: Schema.Types.ObjectId,
    ref: 'CommentList'
  },
  reviewList: {
    type: Schema.Types.ObjectId,
    ref: 'ReviewList'
  },
  initial_resource: Schema.Types.ObjectId,
  content: {
    type: Schema.Types.Mixed
  },
  contentCount: Number
  /*
  content: {
    (ObjectId): {
      test: [Function] // For Conditionals
      child: {
        type: Schema.Types.ObjectId
        refPath: 'childKind'
      }
      childKind: String -- Video / Article / Conditional / ...
    }
  }
  */
})

Path.pre('save', function () {
  if (this.isNew) {
    let commentList = new CommentList()
    let reviewList = new ReviewList()
    this.commentList = commentList._id
    this.reviewList = reviewList._id
    commentList.save()
    reviewList.save()
  }
})

module.exports = mongoose.model('Path', Path, 'Paths')
