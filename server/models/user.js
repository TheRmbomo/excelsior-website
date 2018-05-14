const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    trim: true,
    minlength: 3
  },
  nickName: {
    type: String,
    trim: true
  },
  level: {
    type: Number,
    default: 0
  },
  bio: {
    type: String,
    default: ''
  },
  tokens: [{
    access: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    }
  }]
});

UserSchema.methods.toJSON = function () {
  var user = this;
  var userObject = user.toObject();

  return _.pick(userObject, ['_id', 'email', 'name', 'nickname', 'level']);
};

UserSchema.methods.generateAuthToken = function () {
  var user = this;
  var access = 'auth';
  var token = jwt.sign({_id: user._id.toHexString(), access}, process.env.JWT_SECRET).toString();

  if (user.tokens.length > 5) user.tokens.splice(0,1);
  user.tokens = user.tokens.concat([{access, token}]);
  return user.save().then(() => token);
};

UserSchema.methods.removeToken = function (token) {
  var user = this;
  return user.update({
    $pull: {tokens: {token}}
  });
};

UserSchema.statics.findByToken = function (token) {
  var User = this;
  var decoded;

  try {decoded = jwt.verify(token, process.env.JWT_SECRET);}
  catch (e) {return Promise.reject();}

  return User.findOne({
    _id: decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  });
};

UserSchema.statics.findByCredentials = function (email, password) {
  var User = this;
  if (!validator.isEmail(email)) return Promise.reject({error: 'Invalid email'});
  return User.findOne({email: new RegExp('^'+email, 'i')})
    .then(user => {
      if (!user) return Promise.reject({error: 'User not found'});
      return new Promise((resolve, reject) => {
        bcrypt.compare(password, user.password, (err, res) => {
          if (res) resolve(user);
          else reject({error: 'Incorrect password'});
        });
      })
    });
};

UserSchema.pre('save', function (next) {
  var user = this;
  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
      });
    });
  }
  next();
});

var User = mongoose.model('User', UserSchema);

module.exports = {
  User
};
