const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ReviewList = new Schema({
  reviews: [{
    history: [{
      response: String,
      date: Date
    }],
    rating: {
      type: Number,
      required: true
    }
  }]
})

module.exports = mongoose.model('ReviewList', ReviewList, 'ReviewLists')
