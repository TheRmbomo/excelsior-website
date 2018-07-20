const path = require('path')
const fs = require('fs')
const formidable = require('formidable')
const uuid = require('uuid/v4')

module.exports = async (req, res) => {
  var outputPath = path.join(__dirname, '../../public/files/'),
      form = new formidable.IncomingForm(),
      sent = true, filename, fields, size, i = 100
  form.maxFileSize = 5 * 1024 * 1024
  form.uploadDir = outputPath

  while (filename = uuid(), q = await new Promise(resolve =>
  fs.open(outputPath + filename, 'r', err => resolve(err))), i--, !q && i>0);
  if (i === 0) filename = 'file'

  // Since formidable doesn't catch non-existent directories, I have to do so
  // explicitly.
  try {
    let q = await new Promise(resolve => {
      fs.readdir(outputPath, err => resolve(err))
    })
    if (q) throw 'error'
  } catch (e) {
    return Promise.resolve({error: 'undefined_directory'})
  }
  form.parse(req, (err, resFields, resFiles) => {
    files = Object.keys(resFiles).map(key => resFiles[key])
    files.map(file =>
      Object.keys(file).map(key => {
        switch (key) {
          case 'size': case 'path': case 'name': case 'type': break
          default: delete file[key]
        }
      })
    )
    fields = resFields
  })

  form.onPart = part => {
    // Has to be empty string, non-file fields.filename are undefined
    if (part.filename === '') {
      return sent = false
    }
    form.handlePart(part)
  }

  form.on('fileBegin', (name, file) => file.path = outputPath + filename)

  sent = await Promise.race([
    new Promise(resolve => {
      form.on('error', err => {
        // console.log('error');
        fs.stat(outputPath + filename, (err, stats) => {
          if (err) return
          fs.unlink(outputPath + filename, err => err)
        })
        resolve(false)
      })
    }),
    new Promise(resolve => {
      form.on('aborted', () => {
        console.log('ab');
        resolve(false)
      })
    }),
    new Promise(resolve => form.on('end', () => resolve(sent)))
  ])

  return (sent) ? Promise.resolve({filename, files}) : Promise.resolve({error: 'cancelled'})
}
