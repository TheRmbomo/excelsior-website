const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Resource = require('./resource')

const Article = new Schema({})

module.exports = Resource.discriminator('Article', Article)
