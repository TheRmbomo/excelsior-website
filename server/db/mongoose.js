const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO, {useNewUrlParser: true})
.then(res => console.log('Connected to Mongo'))
.catch(e => console.log('Could not connect to Mongo'))
