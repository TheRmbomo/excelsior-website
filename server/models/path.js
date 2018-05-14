const mongoose = require('mongoose');
const _ = require('lodash');

var UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    minlength: 6
  }
});

var Path = mongoose.model('Path', UserSchema);

module.exports = {
  Path
};
