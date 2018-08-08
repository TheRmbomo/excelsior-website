const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')
const ResourceHistory = require('./resourceHistory')

var trueBool = {
  type: Boolean,
  default: true
}

const User = new Schema({
  sql_id: Buffer,
  description: String,
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
  },
  show_name: trueBool,
  show_joinDate: trueBool,
  show_followedPaths: trueBool,
  show_description: trueBool,
  show_excelsiorSkills: trueBool,
  show_location: Boolean,
  show_workHistory: Boolean,
  show_externalSkills: Boolean,
  show_birthday: Boolean,
  show_managedPaths: Boolean
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
