const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Resource = require('./resource')

const Article = new Schema({
  body_path: String
})

module.exports = Resource.discriminator('Article', Article, 'Articles')
