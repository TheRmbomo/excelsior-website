const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/ExcelsiorDB')
.then(res => true,
  e => console.log('Could not connect to Mongo database')
);

module.exports = {mongoose};
