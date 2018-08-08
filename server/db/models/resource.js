const mongoose = require('mongoose')
const Schema = mongoose.Schema

var trueBool = {
  type: Boolean,
  default: true
}

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

module.exports = mongoose.model('Resource', Resource, 'Resources')
