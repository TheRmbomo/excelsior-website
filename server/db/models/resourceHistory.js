const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ResourceHistory = new Schema({
  history: Schema.Types.Mixed
  /*
  history: {
    Resource-id: Date
  }
  */
})

module.exports = mongoose.model('ResourceHistory', ResourceHistory, 'ResourceHistories')
