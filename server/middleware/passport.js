const express = require('express')
const session = require('express-session')
const RedisStore = require('connect-redis')(session)
const redisClient = new RedisStore({
  host: 'www.excelsiorindustries.com',
  port: 6379,
  pass: process.env.REDIS
})
module.exports.redisClient = redisClient
const passport = require('passport')
const LocalStrategy = require('passport-local')
const FacebookStrategy = require('passport-facebook')
const valid = require('validator')
const scrypt = require('scrypt')
const uuidParse = require('uuid-parse').parse
const xor = require('buffer-xor')

const {app} = require('./../app')
const {pgQuery} = require('./../db/pg')
const User = require('./../db/models/user')

app
.use(session({
  store: redisClient,
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: false
  }
}))
.use(passport.initialize()).use(passport.session())
.use((err, req, res, next) => {
  console.log('err', err)
  if (err) {
    req.logout()
    next()
  }
})
.use((req, res, next) => {
  if (!req.user) return next()

  res.locals['logged-in'] = true
  res.locals['user-url'] = `${req.user.username || 'user'}-${req.user.shortened_id}`
  res.locals['user-avatar'] = `${req.user.avatar_path || '/img/default_avatar.png'}`
  next()
})

var shortenId = id => {
  let buffer = new Buffer(uuidParse(id)),
  a = buffer.slice(0,8), b = buffer.slice(8,16),
  shortened_id = xor(a,b)
  pgQuery(`UPDATE users SET shortened_id=$1 WHERE id=$2;`, [shortened_id, id])
  .catch(e => e)
  return shortened_id
},
userAuth = strategy => (req, res, next) => passport.authenticate(strategy, (err, user, info) => {
  if (err) return res.redirect('/login')
  if (!user) {
    var message = (info && info.message) ? info.message : 'Invalid credentials'
    return res.redirect('/login')
  }

  req.login(user, err => {
    if (err) return next('nf')

    let username = (user.username) ? user.username : 'user'
    return res.redirect(`/user/${username}-${user.shortened_id.toString('hex')}#`)
  })
})(req, res, next),
createUser = opt => new Promise((resolve, reject) => {
  opt = Object.assign({
    params: [],
    returning: 'id'
  }, opt)
  if (!opt.properties || !opt.values) {
    return reject('Required: properties, values')
  }
  let doc_user = new User()
  opt.params.push(doc_user._id.toString())
  opt.properties.push('mongo_id')
  opt.properties = (opt.properties.length > 1) ? `(${opt.properties.toString()})` : opt.properties.toString()
  opt.values.push(`$${opt.params.length}`)
  opt.values = (opt.values.length > 1) ? `(${opt.values.toString()})` : opt.values.toString()
  pgQuery(`INSERT INTO users ${opt.properties}
  values ${opt.values} RETURNING ${opt.returning}`, opt.params)
  .then(q => q.rows[0])
  .then(user => {
    if (user.code) {
      return reject('Error: Cannot connect to database')
    }
    console.log('PLACEHOLDER: Email sent')
    user.shortened_id = shortenId(user.id)
    doc_user.sql_id = new Buffer(uuidParse(user.id))
    doc_user.save()
    return resolve(user)
  })
})

Object.assign(module.exports, {
  shortenId,
  userAuth,
  createUser
})

app.get(`/auth/facebook`, passport.authenticate('facebook'))
app.get(`/auth/facebook/callback`, userAuth('facebook'))
app.get('/login-user', (req, res) => res.redirect('/login'))
app.post('/login-user', express.json(), express.urlencoded({extended: true}), userAuth('local'))

const facebookStrategy = {
  clientID: '1810426922597279',
  clientSecret: '5dc007a3b201e21c034b8a8e29f19737',
  callbackURL: '/auth/facebook/callback',
  redirect_uri: '',
  profileFields: ['id', 'displayName', 'email']
}

const localStrategy = {
  usernameField: 'email'
}

passport
.use(new FacebookStrategy(facebookStrategy,
  (accessToken, refreshToken, facebookUser, done) => {
    return pgQuery(`SELECT id, shortened_id, username FROM users
    WHERE external_ids @> ARRAY[$1]::varchar[];`, [facebookUser.id])
    .then(q => q.rows)
    .then(ext_users => {
      if (ext_users.length) {
        // Found Excelsior user(s) connected to this Facebook account
        // Keeping nesting open to keep DRY
        if (ext_users.length === 1) return ext_users[0]
        else {
          // TODO: We've found multiple Excelsior accounts on this associated with this
          // Facebook account. Which would you like to log in to?
          throw 'multiple ext'
        }
      } else if (facebookUser.emails.length) { // No Excelsior accounts already with this FB account
        // The FB account has email, though. Time to look for Excelsior accounts with same emails
        return new Promise((resolve, reject) => {
          // TODO: We've found multiple accounts with emails: '...'
          // Please select those you'd like to connect this Facebook account with.
          // Don't worry, you can skip this step and complete it later. It will be in your
          // user account settings
          Promise.all(facebookUser.emails.map(email => pgQuery(`SELECT id, shortened_id, username
            FROM users WHERE emails @> ARRAY[$1]::varchar[];`, [email.value])
            // Matching each email on the Facebook account with verified emails on local
            // accounts if they exist.
            // TODO: Check that the emails are verified
            .then(q => q.rows)
            .then(accounts => (accounts.length) ? accounts : null)
            .catch(e => null)
          ))
          .then(related_accounts => Array.prototype.concat.apply([],related_accounts).filter(i => !!i))
          .then(related_accounts => {
            // No common emails found in Excelsior
            if (!related_accounts.length) {
              // TODO: Which email would you like to use to sign up to Excelsior with?
              // Don't worry, you can complete this step later.
              console.log('No emails found | Creating new user')
              return createUser({
                properties: ['emails', 'external_ids', 'display_name'],
                values: ['ARRAY[$1]','ARRAY[$2]','$3'],
                params: [facebookUser.emails[0].value, facebookUser.id, facebookUser.displayName]
              })
            }

            // Just one Excelsior account found
            if (related_accounts.length === 1) {
              return pgQuery(`UPDATE users SET external_ids = array_append(external_ids,$1)
              WHERE id=$2 RETURNING id, username`, [facebookUser.id, related_accounts[0].id])
              .then(q => q.rows[0])
            }

            // Multiple Excelsior accounts found with the associated email(s)
            if (related_accounts.length > 1) {throw 'multiple related'}
          })
          .then(resolve)
          .catch(reject)
        })
      } else return null // Reject users without emails
    })
    .then(user => {
      if (!user) return done('User not found')
      user.strategy = 'facebook'
      return done(null, user)
    })
    .catch(e => console.log(e))
  }
))
.use(new LocalStrategy(localStrategy, (email, password, done) => {
  var user, error = {},
  is_error = () => Object.keys(error).length

  if (!email) error.email = {type: 'required'}
  else if (!valid.isEmail(email + '')) error.email = {type: 'invalid'}
  if (!password) error.password = {type: 'required'}
  else if (!valid.isLength(password + '', {min: 6})) error.password = {type: 'length'}
  if (is_error()) return done(error)

  pgQuery(`SELECT id, username, hashed_password FROM users
  WHERE emails @> ARRAY[$1]::varchar[];`, [email])
  .then(q => {
    if (!q.rows.length) error.user = {type: 'invalid'}
    else if (q.rows.length > 1) error.user = {type: 'multiple'} // Placeholder
    else return (user = q.rows[0], user)
    if (is_error()) throw (done(error), error)
  })
  .then(user => {
    if (!user) error.user = {type: 'invalid'}
    else if (!user.hashed_password) error.password = {type: 'incorrect'}
    if (is_error()) throw (done(error), error)
    return scrypt.verifyKdf(user.hashed_password, password)
  })
  .then(is_correct => {
    if (!is_correct) error.password = {type: 'incorrect'}
    if (is_error()) throw (done(error), error)

    delete user.hashed_password
    delete user.is_correct
    user.strategy = 'local'
    user.shortened_id = shortenId(user.id)
    return done(null, user)
  })
  .catch(e => console.log('local', e))
}))

passport.serializeUser((user, done) => {
  delete user.strategy
  done(null, user.id)
})

passport.deserializeUser(async (userId, done) => {
  pgQuery(`SELECT id, username, display_name, avatar_path, shortened_id,
  paths_following, mongo_id FROM users WHERE id=$1`, [userId])
  .then(q => q.rows[0])
  .then(user => {
    if (!user) return done({user: 'invalid'})
    else {
      user.shortened_id = user.shortened_id.toString('hex')
      return done(null, user)
    }
  })
  .catch(error => done({session: 'invalid', error}))
})
