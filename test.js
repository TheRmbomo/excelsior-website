const expect = require('chai').expect
const request = require('request')
const uuid = require('uuid/v4')

const validation = require('./server/middleware/validation')

var address = ext => 'http://192.168.1.223:3000' + ext

describe('path', () => {
  it('should create one', done => {
    request.post({
      url: address('/create-path'),
      headers: {
        cookie: 'connect.sid=s%3AJXgQ9lC13-RVXEHcX5y4TZ7Aii0ZZuxD.rb510Q6Lgc%2BJtwgXk9IOS60fvUVKF2UpFGy9fb83vwk'
      },
      formData: {
        create: 'false',
        display_name: 'Ye s&a2%^.,3',
        id: uuid()
      }
    })
    .on('response', res => {
      expect(res.statusCode).to.equal(200)
      // res.pipe(process.stdout)
      done()
    })
  })
})

describe('resource', () => {
  it('should create one without source', done => {
    request.post({
      url: address('/create-content'),
      headers: {
        cookie: 'connect.sid=s%3AJXgQ9lC13-RVXEHcX5y4TZ7Aii0ZZuxD.rb510Q6Lgc%2BJtwgXk9IOS60fvUVKF2UpFGy9fb83vwk'
      },
      formData: {
        create: 'false',
        display_name: 'Ye s&a2%^.,3',
        id: uuid()
      }
    })
    .on('response', res => {
      expect(res.statusCode).to.equal(200)
      done()
    })
  })
  it('should fail with invalid source', done => {
    request.post({
      url: address('/create-content'),
      headers: {
        cookie: 'connect.sid=s%3AJXgQ9lC13-RVXEHcX5y4TZ7Aii0ZZuxD.rb510Q6Lgc%2BJtwgXk9IOS60fvUVKF2UpFGy9fb83vwk'
      },
      formData: {
        create: 'false',
        display_name: 'Ye s&a2%^.,3',
        id: uuid(),
        source: 'a'
      }
    })
    .on('response', res => {
      expect(res.statusCode).to.equal(400)
      let body = ''
      res.on('data', chunk => body = body + chunk.toString())
      res.on('end', a => {
        expect(body).to.equal('Invalid: source')
        done()
      })
    })
  })
})

describe('validation', () => {
  it('should process internal names', () => {
    expect(validation.metadata(['name', 'thermbo2& @0218'])).to.equal('thermbo2_0218')
  })
  it('should detect field lengths', () => {
    var longstring = ''
    while (longstring.length < 1000+1) { longstring += '.' }
    expect(() => validation.metadata(['description', 'salmon'])).to.not.throw()
    validation.metadata(['description', longstring], err => expect(err).to.equal('Too long'))
  })
})
