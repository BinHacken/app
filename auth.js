const db = require('./db.js');
const hash = require('./hash.js');
const cookie = require('./cookie.js');
const tanlist = require('./tan.js');

function checkLogin(req, res, url) {
  if (req.session.loggedin) {
    return true;
  } else {
    res.redirect(`/login?url=${url}`);
    return false;
  }
}

function createSession(req, res) {
  return new Promise((resolve, reject) => {
    if (req.session.loggedin) {
      resolve();
      return;
    }

    var _cookie = cookie.get(req);

    if (!_cookie.username || !_cookie.sid || !_cookie.token) {
      reject();
      return;
    }

    db.authSession(_cookie.username, _cookie.sid, _cookie.token).then((session) => {
      if (session && session.token) {
        console.log("Authenticated!");
        console.log(`Setting new token ${session.token}`);

        cookie.set(res, {
          token: session.token
        });

        req.session.loggedin = true;
        req.session.username = _cookie.username
      } else {
        cookie.clear(res);
        throw new Error('Benutzername schon vergeben');
      }
    }).then(resolve).catch(reject);
  });
}

function login(req, res, username, password) {
  return db.auth(username, password).then((ok) => {
    if (ok) {
      req.session.loggedin = true;
      req.session.username = username;
    } else {
      throw new Error('Benutzername schon vergeben');
    }
  }).then(() => {
    return db.createSession(username);
  }).then((user) => {
    cookie.set(res, {
      username: user.username,
      sid: user.sid,
      token: user.token
    });
  });
}

function register(req, res, username, password, tan) {
  return new Promise((resolve, reject) => {
    if (!username || !password) {
      reject(new Error('Ungültiger Benutzername oder Passwort'));
    } else if (!tanlist.check(tan)) {
      reject(new Error('Falsche TAN'));
    } else {
      resolve();
    }
  }).then(() => {
    return db.getUserData(username);
  }).then((user) => {
    if (user) {
      throw new Error('Benutzername schon vergeben');
    }
  }).then(() => {
    db.createUser(username, password);
  }).then(() => {
    req.session.loggedin = true;
    req.session.username = username;
  });
}

function rename(req, res, old_username, new_username) {
  return db.exists(new_username).then((existing) => {
    if (existing) {
      console.log("")
      throw new Error('Benutzername schon vergeben');
    }
  }).then(() => {
    db.updateUser(old_username, 'name', new_username);
  }).then(() => {
    req.session.username = new_username;

    cookie.set(res, {
      username: new_username
    });

    db.renameSession(old_username, new_username);
  });
}

module.exports = {
  checkLogin,
  createSession,
  login,
  register,
  rename
};