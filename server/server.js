require('./config/config');

const path = require ('path');
const express = require('express');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const cookieParser = require('cookie-parser');
// const fs = require('fs');

require('./db/mongoose');

const public = path.join(__dirname + '/../public');
var app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(public));
app.use(cookieParser())
app.set('views', path.join(__dirname + '/views'));
app.set('view engine', 'hbs');
hbs.registerPartials(path.join(__dirname + '/views/partials'));

hbs.registerHelper('getCurrentYear', () => {
  return new Date().getFullYear();
});

module.exports = {app};
require('./routes/web-routes');
require('./socketio');
