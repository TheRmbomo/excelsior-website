const passport = require('passport');
const LocalStrategy = require('passport-local');
const Auth0Strategy = require('passport-auth0');
const FacebookStrategy = require('passport-facebook');
const valid = require('validator');
const scrypt = require('scrypt');
const uuidParse = require('uuid-parse').parse;
const xor = require('buffer-xor');

const {app} = require('./../app');
const {pgQuery} = require('./../db/pg');

app
.use(passport.initialize()).use(passport.session())
.use((err, req, res, next) => {
  console.log('err', err);
  if (err) {
    req.logout();
    next();
  }
})
.use((req, res, next) => {
  if (!req.user) return next();

  res.locals['logged-in'] = true;
  res.locals['user-url'] = `${req.user.username || 'user'}-${req.user.shortened_id}`;
  res.locals['user-avatar'] = `${req.user.avatar_path || '/img/default_avatar.png'}`;
  next();
});

let shortenId = id => {
  let buffer = new Buffer(uuidParse(id)),
    a = buffer.slice(0,8), b = buffer.slice(8,16),
    shortened_id = xor(a,b),
    q = pgQuery(`UPDATE users SET shortened_id=$1 WHERE id=$2;`, [shortened_id, id]);
  return shortened_id;
}

module.exports.shortenId = shortenId;

userAuth = strategy => (req, res, next) => passport.authenticate(strategy, (err, user, info) => {
  if (err) return next(JSON.stringify(err));

  if (!user) {
    var message = info.message || 'Invalid credentials';
    return res.redirect('/login');
  }
  console.log('auth', user);

  req.login(user, err => {
    if (err) return next(err);

    console.log('login', user);
    let username = (user.username) ? user.username : 'user';
    return res.redirect(`/user/${username}-${user.shortened_id.toString('hex')}#`);
  });
})(req, res, next);

['auth0', 'facebook'].map(strategy => {
  app.get(`/auth/${strategy}`, passport.authenticate(strategy));
  app.get(`/auth/${strategy}/callback`, userAuth(strategy));
});

app.post('/login-user', userAuth('local'));

const auth0Strategy = {
  domain: 'excelsiorindustries.auth0.com',
  clientID: 'MwoO9LDnv9eLUFVHPI0hMFWsDrtINYbm',
  clientSecret: 'TjUfhy9rTFKAzzY_4bEtl09RDX4lNmNQBDT3PDWgyV2voVt9r7YLJHU7KlPqKTaj',
  callbackURL: '/auth/auth0/callback',
  scope: ['openid', 'email', 'profile']
};

const facebookStrategy = {
  clientID: '1810426922597279',
  clientSecret: '5dc007a3b201e21c034b8a8e29f19737',
  callbackURL: '/auth/facebook/callback',
  redirect_uri: '',
  profileFields: ['id', 'displayName', 'email']
};

const localStrategy = {
  usernameField: 'email'
};

passport
.use(new Auth0Strategy(auth0Strategy,
  (accessToken, refreshToken, extraParams, user, done) => {
    done(null, user);
  }
))
.use(new FacebookStrategy(facebookStrategy,
  async (accessToken, refreshToken, facebookUser, done) => {
    let user = {};
    let extId_users = await pgQuery(`SELECT id, shortened_id, username FROM users
      WHERE external_ids @> ARRAY[$1]::varchar[];`, [facebookUser.id]);
    if (extId_users.rows.length) { // Found Excelsior user(s) connected to this Facebook account
      // Keeping nesting open to keep DRY
      if (extId_users.rows.length === 1) { // Excelsior account(s) connected
        user = extId_users.rows[0];
      } else {
        // TODO: We've found multiple Excelsior accounts on this associated with this
        // Facebook account. Which would you like to log in to?
      }
    } else if (facebookUser.emails.length) { // No Excelsior accounts already with this FB account
      // The FB account has email, though. Time to look for Excelsior accounts with same emails
      let related_accounts = [];
      // TODO: We've found multiple accounts with emails: '...'
      // Please select those you'd like to connect this Facebook account with.
      // Don't worry, you can skip this step and complete it later. It will be in your
      // user account settings
      for (let i=facebookUser.emails.length-1, email, q; i>=0; i--) {
        // Matching each email on the Facebook account with verified emails on local
        // accounts if they exist.
        email = facebookUser.emails[i].value;
        q = await pgQuery(`SELECT id, shortened_id, username FROM users
          WHERE emails @> ARRAY[$1]::varchar[];`, [email]);
        if (!q.rows.length) continue;
        else related_accounts = related_accounts.concat(q.rows);
      } // End for-loop
      if (!related_accounts.length) { // No common emails found in Excelsior
        console.log('No emails found | Creating new user');
        // TODO: Which email would you like to use to sign up to Excelsior with?
        // Don't worry, you can complete this step later.
        let q = await pgQuery(`INSERT INTO users (emails, external_ids, display_name)
          values (ARRAY[$1],ARRAY[$2],$3) RETURNING id`, [facebookUser.emails[0].value, facebookUser.id, facebookUser.displayName]);
        user = q.rows[0];

        console.log('PLACEHOLDER: Email sent');
        user.shortened_id = shortenId(user.id);

      } else {
        // Keeping the nesting here for potential keeping DRY
        // Both 1 and >1 will likely have repeat code
        if (related_accounts.length > 1) {
          // Multiple Excelsior accounts found with the associated email(s)
        } else {
          // Just one Excelsior account found
          let q = await pgQuery(`UPDATE users SET external_ids = array_append(external_ids,$1)
            WHERE id=$2 RETURNING id, username;`, [facebookUser.id, related_accounts[0].id]);
          user = q.rows[0];
        }
      }
    } else { // No emails on the Facebook account
      let q = await pgQuery(`INSERT INTO users (external_ids, display_name)
        values (ARRAY[$1],$2) RETURNING id;`, [facebookUser.id, facebookUser.displayName]);
      user = q.rows[0];

      console.log('PLACEHOLDER: Email sent');
      user.shortened_id = shortenId(user.id);
    }
    user.strategy = 'facebook';
    done(null, user);
  }
))
.use(new LocalStrategy(localStrategy,
  async (email, password, done) => {
    let error = {}, checkErrors = () => {
      if (Object.keys(error).length) {
        done(error);
        return 1;
      }
      return 0;
    };
    if (!email) error.email = {type: 'required'};
    else if (!valid.isEmail(email + '')) error.email = {type: 'invalid'};
    if (!password) error.password = {type: 'required'};
    else if (!valid.isLength(password + '', {min: 6})) error.password = {type: 'length'};
    if (checkErrors()) return;

    let q = await pgQuery(`SELECT id, username, hashed_password
      FROM users WHERE emails @> ARRAY[$1]::varchar[];`, [email]);
    if (!q.rows.length) error.email = {type: 'missing'};
    else if (q.rows.length > 1) error.email = {type: 'multiple'}; // Placeholder
    if (checkErrors()) return;

    let user = q.rows[0];
    if (user && user.hashed_password && await scrypt.verifyKdf(user.hashed_password, password)) {
      console.log('Password verified');
    } else error.password = {type: 'incorrect'};
    if (checkErrors()) return;

    delete user.hashed_password;
    user.strategy = 'local';
    user.shortened_id = shortenId(user.id);
    return done(null, user);
  }
));

passport.serializeUser((user, done) => {
  delete user.strategy;
  done(null, user.id);
});

passport.deserializeUser(async (userId, done) => {
  try {
    let users = await pgQuery(`SELECT id, username, display_name, avatar_path, shortened_id
      FROM users WHERE id=$1;`, [userId]);
    if (!users.rows.length) return done('user-not-found');
    else {
      let user = users.rows[0];
      user.shortened_id = users.rows[0].shortened_id.toString('hex');
      console.log('deserialize', user);
      return done(null, user);
    }
  } catch (e) {
    return done('invalid-session');
  }
});
