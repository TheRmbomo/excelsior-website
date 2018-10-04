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
  content: Schema.Types.Mixed,
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
  content: [
    {
      url: String,
      next: Number > content[Number]
    },
    {
      test: () => {},
      choices: [
        Number, Number, Number, ... > content[Number]
      ]
    }
  ]
  */
})

Path.pre('save', function () {
  // if (this.isNew) {
  //   let reviewList = new ReviewList()
  //   this.reviewList = reviewList._id
  //   reviewList.save()
  // }
})

Path.post('remove', function () {
  if (this.commentList) CommentList.findById(this.commentList)
  .then(doc => doc.remove())
  if (this.reviewList) ReviewList.findById(this.reviewList)
  .then(doc => doc.remove())
  PathStatus.find({path: this._id})
  .then(docs => docs.map(doc => doc.remove()))
})

module.exports = mongoose.model('Path', Path, 'Paths')
