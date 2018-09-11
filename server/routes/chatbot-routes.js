const express = require('express')
const mongoose = require('mongoose')
const hbs = require('hbs')
const {ObjectId} = mongoose.Schema.Types

const {app} = require('./../app')
// Legacy
var r_string = {
  type: String,
  trim: true,
  minlength: 6,
  required: true
}

var s_string = {
  type: String,
  trim: true,
  minlength: 6
}

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
})

var ResourceSchema = new mongoose.Schema({
  name: r_string,
  url: s_string,
  content: s_string,
  comments: [UserResponseSchema]
})

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
})

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
})

var Path = mongoose.model('Path2', PathSchema, 'paths')

app.get('/oldpaths/:id', (req, res, next) => {
  var {id} = req.params
  Path.findById(id)
  .then(doc => {
    if (!doc) return next('nf')
    res.render('resource', {
      title: path.name,
      embed: true,
      hide_header: true,
      hide_footer: true
    })
  })
  .catch(e => next('nf'))
})

app.get('/oldpaths/:pathid/:videoid', (req, res, next) => {
  let {pathid, videoid} = req.params
  Path.findById(pathid)
  .then(doc => {
    if (!doc) return next('nf')
    var video = doc.content.id(videoid), index = doc.content.indexOf(video),
    button = (href, label, disabled) => new hbs.SafeString(`<div ${
      'class="td center padding round"'
    }>${
      `<a href="${href}"><button style="width: 8em;" ${disabled}>${label}</button></a>`
    }</div>`)

    if (index > 0) {
      var previous = button(`/oldpaths/${pathid}/${
        doc.content[index-1]._id.toString()
      }`, 'Previous')
    }
    else var previous = button('#', 'Previous', 'disabled')

    if (index < doc.content.length-1) {
      var next = button(`/oldpaths/${pathid}/${
        doc.content[index+1]._id.toString()
      }`, 'Next')
    }
    else var next = button('#', 'Next', 'disabled')
    res.render('resource', {
      title: video.name,
      embed: true,
      resource: {
        source: video.url,
        legacy: true,
        legacy_previous: previous,
        legacy_next: next
      },
      hide_header: true,
      hide_footer: true
    })
  })
  .catch(e => next('nf'))
})
//

app.get('/webview/:path/:videoid', (req, res) => {
  var {path, videoid} = req.params
  const {userId} = req.query
  const first_name = req.query['first name']
  const displayUrl = `https://www.axysmundi.com/oldpaths/${path}/${videoid}`
  res.json({
    messages: [
      {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            image_aspect_ratio: 'square',
            elements: [
              {
                title: `Hi, ${first_name}! Here's the video:`,
                buttons: [
                  {
                    type: 'web_url',
                    url: displayUrl,
                    title: 'Watch here',
                    messenger_extensions: true,
                    webview_heigh_ratio: 'full'
                  }
                ]
              }
            ]
          }
        }
      }
    ]
  })
})
