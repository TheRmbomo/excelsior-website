const mongoose = require('mongoose');
const {ObjectId} = mongoose.Schema.Types;
const _ = require('lodash');

var r_string = {
  type: String,
  trim: true,
  minlength: 6,
  required: true
};

var s_string = {
  type: String,
  trim: true,
  minlength: 6
};

var UserResponseSchema = new mongoose.Schema({
  _userid: {
    type: ObjectId,
    required: true
  },
  username: {
    type: String,
    default: null
  },
  response: r_string
});

var ResourceSchema = new mongoose.Schema({
  name: r_string,
  url: s_string,
  content: s_string,
  comments: [UserResponseSchema]
});

var Resource = mongoose.model('Resource', ResourceSchema);

module.exports = {
  Resource, ResourceSchema, UserResponseSchema
};
