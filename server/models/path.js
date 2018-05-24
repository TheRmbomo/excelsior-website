const mongoose = require('mongoose');
const {ObjectId} = mongoose.Schema.Types;
const _ = require('lodash');

const {ResourceSchema, UserResponseSchema} = require('./resource');

var r_string = {
  type: String,
  trim: true,
  minlength: 6,
  required: true
};

var UserReviewSchema = new mongoose.Schema({
  _userid: {
    type: ObjectId,
    required: true
  },
  username: {
    type: String
  },
  review: r_string,
  rating: {
    type: Number,
    required: true
  }
});

var PathSchema = new mongoose.Schema({
  name: r_string,
  description: r_string,
  rating: {
    type: Number,
    default: 0
  },
  content: [ResourceSchema],
  userreviews: [UserReviewSchema],
  comments: [UserResponseSchema]
});

var Path = mongoose.model('Path', PathSchema);

module.exports = {
  Path, UserReviewSchema
};
