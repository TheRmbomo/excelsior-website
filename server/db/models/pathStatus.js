const mongoose = require('mongoose')
const Schema = mongoose.Schema

const PathStatus = new Schema({
  path: {
    type: String,
    ref: 'Path'
  },
  user: {
    type: String,
    ref: 'User'
  },
  status: String,
  last_updated: {
    type: Date,
    default: new Date
  },
  progress: [{
    resource: {
      type: Schema.Types.ObjectId,
      refPath: 'progress.kind'
    },
    kind: String
  }]
})

module.exports = mongoose.model('PathStatus', PathStatus, 'PathStatus')
