const path = require('path')
const fs = require('fs')
const formidable = require('formidable')
const uuid = require('uuid/v4')

const {errorlog} = require('./../app.js')

module.exports = opt => (req, res, next) => {
  opt = Object.assign({
    outputPath: path.join(__dirname, '../../public/'),
    min: 0,
    max: 5 * 1024 * 1024,
    multiple: true
  }, opt)

  var form = new formidable.IncomingForm(), receivedFiles = false, newPaths = []
  Object.assign(form, {
    maxFileSize: opt.max,
    multiple: opt.multiple,
    uploadDir: ''
  })

  check_filenames = (genId, i=10) => {
    var id = genId()
    return new Promise((resolve, reject) => {
      fs.open(opt.outputPath + id, 'r', (err, fd) => err ? resolve(err) : reject(fd))
    })
    .then(err => id)
    .catch(fd => {
      fs.close(fd, err => err)
      return i ? check_filenames(genId, --i) : {error: 'Unable to generate name'}
    })
  }

  form.on('progress', (bytesReceived, bytesExpected) => {
    if (bytesExpected < opt.min) {
      req.pause()
      throw 'File too small'
    }
    else if (bytesExpected > opt.max) {
      req.pause()
      throw 'File too large'
    }
  })

  form.onPart = part => {
    part.addListener('data', data => data);
    form.handlePart(part)
  }

  form.on('file', (name, file) => {
    receivedFiles = true
    if (opt.rename_fn) {
      newPaths.push(check_filenames(opt.rename_fn)
      .then(id => {
        if (id.error) throw id.error
        var newPath = path.join(opt.outputPath, id + '.png')
        fs.rename(file.path, newPath, err => {if (err) throw err})
        return {name, path: newPath}
      })
      .catch(e => fs.unlink(file.path, err => err)))
    }
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)
      if (receivedFiles) {
        if (opt.rename_fn) {
          return Promise.all(newPaths)
          .then(results => {
            results.map(result => files[result.name].path = result.path)
            return resolve({files, fields})
          })
          .catch(e => e)
        }
        else return resolve({files, fields})
      }
      else return resolve({fields})
    })
  })
  .then(data => {
    req.form = data
    if (data.fields) req.body = data.fields
    if (data.files) req.files = data.files
    next()
  })
  .catch(errorlog)
}
