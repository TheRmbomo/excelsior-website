const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ReviewList = new Schema({
  reviews: [{
    type: Schema.Types.ObjectId,
    ref: 'Review'
  }]
})

module.exports = mongoose.model('ReviewList', ReviewList, 'ReviewLists')
