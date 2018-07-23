const express = require('express')
const path = require('path')

const {app} = require('./../app')
const public = path.join(__dirname + '/../../public')
app.locals.public = public

app.get('/img/:id', (req, res, next) => {
  let {id} = req.params;
  if (id === 'paul.png') console.log('hello paul')
  next()
})

app.use(express.static(public))
