const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TrackedResponse = require('./trackedResponse')

const Review = new Schema(TrackedResponse.extend({
  list: {
    type: Schema.Types.ObjectId,
    ref: 'ReviewList',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 10
  }
}))

module.exports = mongoose.model('Review', Review, 'Reviews')
