const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Resource = require('./resource')

const Video = new Schema({
  minutes_watched: Number,
  times_played: Number
})

Video.virtual('average_minutes_watched').get(function () {
  return this.minutes_watched / this.times_played
})

module.exports = Resource.discriminator('Video', Video, 'Videos')
