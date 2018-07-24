const mongoose = require('mongoose');
const {ObjectId} = mongoose.Schema.Types;
const _ = require('lodash');

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
