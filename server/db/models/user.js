const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommentList = require('./commentList')
const ResourceHistory = require('./resourceHistory')
const PathStatus = require('./pathStatus')
const UserActivity = require('./userActivity')
const UserResponse = require('./userResponse')

var trueBool = {
  type: Boolean,
  default: true
}

const User = new Schema({
  _id: String,
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

User.post('remove', function () {
  CommentList.findById(this.commentList)
  .then(doc => doc.remove())
  ResourceHistory.findById(this.resourceHistory)
  .then(doc => doc.remove())
  PathStatus.find({user: this._id})
  .then(docs => docs.map(doc => doc.remove()))
  UserActivity.find({user: this._id})
  .then(docs => docs.map(doc => doc.remove()))
  UserResponse.find({author: this._id})
  .then(docs => docs.map(doc => doc.remove()))
})

module.exports = mongoose.model('User', User, 'Users')
