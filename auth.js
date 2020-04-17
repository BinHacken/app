const db = require('./db.js');
const cookie = require('./cookie.js');
const tanlist = require('./tan.js');

function checkLogin(req, res) {
  if (req.session.loggedin) {
    return true;
  } else {
    res.redirect(`/login?url=${req.originalUrl.substring(1)}`);
    return false;
  }
}

function startSession(req, res) {
  return new Promise((resolve, reject) => {
    console.log("Start session...");

    if (req.session.loggedin) {
      console.log('Already logged in');
      resolve();
      return;
    }

    var _cookie = cookie.get(req);

    if (!_cookie.sid && !_cookie.token && !_cookie.userId) {
      console.log('No session cookie found');
      reject(new Error('No session cookie found'));
      return;
    } else if (!_cookie.sid || !_cookie.token || !_cookie.userId) {
      console.log('Corrupted session cookie :(');
      cookie.clear(res);
      reject(new Error('Corrupted session cookie :('));
      return;
    }

    db.authSession(_cookie.sid, _cookie.token, _cookie.userId).then((session) => {
      if (session && session.token) {
        console.log("Authenticated!");
        console.log(`Setting new token ${session.token}`);

        cookie.set(res, {
          token: session.token
        });

        req.session.loggedin = true;
        req.session.userId = _cookie.userId
      } else {
        console.log('Corrupted session cookie :(');
        cookie.clear(res);
        throw new Error('Corrupted session cookie :(');
      }
    }).then(resolve).catch(reject);
  });
}

function login(req, res, username, password) {
  return db.getUser({
    'name': username,
    'password_old': password
  }).then(user => {
    if (user) {
      req.session.loggedin = true;
      req.session.userId = user.id;

      return db.createSession(user.id);
    } else {
      throw new Error('Benutzername oder Passwort falsch');
    }
  }).then(session => {
    cookie.set(res, {
      sid: session.sid,
      token: session.token,
      userId: session.userId
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
    return db.getUser({
      'name': username
    });
  }).then((user) => {
    if (user) {
      throw new Error('Benutzername schon vergeben');
    } else {
      return db.createUser(username, password);
    }
  }).then(user => {
    req.session.loggedin = true;
    req.session.userId = user.id;
  });
}

function rename(req, res, userId, new_username) {
  return db.getUser({
    'name': new_username
  }).then(user => {
    if (user) {
      throw new Error('Benutzername schon vergeben');
    } else {
      return db.updateUser(userId, 'name', new_username);
    }
  });
}

module.exports = {
  checkLogin,
  startSession,
  login,
  register,
  rename
};