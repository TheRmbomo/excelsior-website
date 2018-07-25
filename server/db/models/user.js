const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')
const ResourceHistory = require('./resourceHistory')

const User = new Schema({
  description: {
    type: String
  },
  work_history: [{
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company'
    },
    from: Date,
    until: Date,
  }],
  location: String,
  external_skills: [{
    name: String,
    endorsements: Number
  }],
  internal_skills: {
    type: Schema.Types.Mixed
  },
  commentList: {
    type: Schema.Types.ObjectId,
    ref: 'CommentList'
  },
  resourceHistory: {
    type: Schema.Types.ObjectId,
    ref: 'ResourceHistory'
  }
})

User.pre('save', function () {
  if (this.isNew) {
    let commentList = new CommentList()
    let resourceHistory = new ResourceHistory()
    this.commentList = commentList._id
    this.resourceHistory = resourceHistory._id
    commentList.save()
    resourceHistory.save()
  }
})

module.exports = mongoose.model('User', User, 'Users')
