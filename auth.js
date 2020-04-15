const db = require('./db.js');
const hash = require('./hash.js');

function checkLogin(req, res, url) {
  if (req.session.loggedin) {
    return true;
  } else {
    res.redirect(`/login?url=${url}`);
    return false;
  }
}

module.exports = {
  checkLogin
};