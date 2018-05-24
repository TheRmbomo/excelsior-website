const express = require('express');
const bodyParser = require('body-parser');

const {app} = require('./../server');
const {authenticate, loggedin, defProps} = require('./../middleware/authenticate');

app.get('/webview/:path/:videoid', (req, res) => {
  var {path, videoid} = req.params;
  const {userId} = req.query;
  const first_name = req.query['first name'];
  const displayUrl = `https://www.excelsiorindustries.com/paths/${path}/${videoid}`;
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
  });
});
