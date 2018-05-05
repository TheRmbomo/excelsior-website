const {renderPage} = require('./web-routes');

// Calling profile page
var userProfile = (res, user, {private = false, edit = false} = {}) => {
  var {name, bio, email} = user;
  renderPage(res, 'userProfile.hbs', {
    private, edit,
    hasName: (!!name),
    username: (name || email),
    bio
  });
};

// For calling one's own private profile page
var userPrivateProfile = (req, res, edit) => {
  if (req.loggedIn) userProfile(res, req.user, {private: true, edit})
  else res.redirect('/login');
};

module.exports = {
  userProfile, userPrivateProfile
};
