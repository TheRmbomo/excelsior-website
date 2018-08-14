const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')
const ReviewList = require('./reviewList')
const PathStatus = require('./pathStatus')

var trueBool = {
  type: Boolean,
  default: true
}

const Path = new Schema({
  _id: String,
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
  contentCount: Number,
  admins: [{
    type: String,
    ref: 'User'
  }],
  contributors: [{
    type: String,
    ref: 'User'
  }],
  show_description: trueBool
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

Path.post('remove', function () {
  CommentList.findById(this.commentList)
  .then(doc => doc.remove())
  ReviewList.findById(this.reviewList)
  .then(doc => doc.remove())
  PathStatus.find({path: this._id})
  .then(docs => docs.map(doc => doc.remove()))
})

module.exports = mongoose.model('Path', Path, 'Paths')
