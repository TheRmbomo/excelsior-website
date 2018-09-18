const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')

var trueBool = {
  type: Boolean,
  default: true
}

const Resource = new Schema({
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
  views: Number,
  rating: {
    likes: Number,
    dislikes: Number
  },
  source_type: String,
  source: String,
  show_description: trueBool
})

Resource.pre('save', function () {
  if (this.isNew) {
    let commentList = new CommentList()
    this.commentList = commentList._id
    commentList.save()
  }
})

Resource.post('remove', function () {
  CommentList.findById(this.commentList)
  .then(doc => doc.remove())
})

module.exports = mongoose.model('Resource', Resource, 'Resources')
