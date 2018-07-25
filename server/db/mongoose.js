const MongoClient = require('mongodb').MongoClient;
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO, {useNewUrlParser: true})
.then(r => console.log('Connected to Mongo'))
.catch(e => console.log('Could not connect to Mongo:', e))
