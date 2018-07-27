const mongoose = require('mongoose')
const Schema = mongoose.Schema

const PathStatus = new Schema({
  path: {
    type: Schema.Types.ObjectId,
    ref: 'Path'
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  status: String,
  last_updated: Date,
  progress: [{
    resource: {
      type: Schema.Types.ObjectId,
      refPath: 'progress.kind'
    },
    kind: String
  }]
})

module.exports = mongoose.model('PathStatus', PathStatus, 'PathStatus')
