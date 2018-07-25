const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Conditional = new Schema({
  type: Schema.Types.Mixed
})

module.exports = mongoose.model('Conditional', Conditional, 'Conditionals')
