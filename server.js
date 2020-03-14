// =========== Globals ========== //
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const db = require('./data.js');
const tanlist = require('./tan.js');
const hash = require('./hash.js');

const app = express();
const waitForDBtoInit = db.init();

const args = process.argv.slice(2);

// ===== Helper functions ===== //

function loggedin(req, res, url) {
  if (req.session.loggedin) {
    return true;
  } else {
    res.redirect(`/login?url=${url}`);
    return false;
  }
}

function deleteCookies(res) {
  res.cookie('session.username', '', {
    maxAge: 0
  }).cookie('session.sid', '', {
    maxAge: 0
  }).cookie('session.token', '', {
    maxAge: 0
  });

  console.log("Deleted cookies");
}

function getCookie(req) {
  return {
    username: req.signedCookies["session.username"],
    sid: req.signedCookies["session.sid"],
    token: req.signedCookies["session.token"]
  };
}

function setCookie(res, data) {
  if (data.username) {
    res.cookie('session.username', data.username, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  if (data.sid) {
    res.cookie('session.sid', data.sid, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  if (data.token) {
    res.cookie('session.token', data.token, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  console.log('Set cookie ');
  console.log(data);
}

// ===== Express App ===== //
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(cookieParser("secret"));

// ===== HTTP Server ===== //
const httpServer = http.createServer(app);
httpServer.listen(80);

// ===== HTTPS Server ===== //
if (args.includes('https')) {
  const privateKey = fs.readFileSync('/etc/letsencrypt/live/binhacken.app/privkey.pem', 'utf8');
  const certificate = fs.readFileSync('/etc/letsencrypt/live/binhacken.app/cert.pem', 'utf8');
  const ca = fs.readFileSync('/etc/letsencrypt/live/binhacken.app/chain.pem', 'utf8');

  const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
  };

  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(443);
}

// ===== GET Callbacks ===== //
app.get('/', function(req, res) {
  res.redirect('/home');
});

app.get('/login', function(req, res) {
  var url = req.query.url;
  url = url ? url : '/home';

  if (req.session.loggedin) {
    res.redirect(`/${url}`);
    return;
  }

  var cookie = getCookie(req);

  var renderPage = function() {
    res.render('login', {
      nope: req.query.nope,
      loggedin: req.session.loggedin,
      url: url
    });
  }

  if (!cookie.username || !cookie.sid || !cookie.token) {
    renderPage();
    return;
  }
  /*
    console.log({
      "Username": username,
      "sid": sid,
      "token": token
    });
  */
  db.authSession(cookie.username, cookie.sid, cookie.token).then((session) => {
    if (session && session.token) {
      console.log("Authenticated!");
      console.log(`Setting new token ${session.token}`);

      setCookie(res, {
        token: session.token
      });

      req.session.loggedin = true;
      req.session.username = cookie.username;

      res.redirect(`/${url}`);
    } else {
      deleteCookies(res);
      renderPage();
    }
  });

});

app.get('/register', function(req, res) {
  res.render('register', {
    nope: req.query.nope,
    loggedin: req.session.loggedin,
    tan: req.query.tan
  });
});

app.get('/home', function(req, res) {
  if (!loggedin(req, res, 'home')) return;

  res.render('home', {
    loggedin: req.session.loggedin
  });
});

app.get('/users', function(req, res) {
  if (!loggedin(req, res, 'users')) return;

  db.getUserList().then((data) => {
    res.render('users', {
      loggedin: req.session.loggedin,
      users: data
    });
  });
});

app.get('/profile', function(req, res) {
  if (!loggedin(req, res, 'profile')) return;

  db.getUserData(req.session.username).then((data) => {
    res.render('profile', {
      loggedin: req.session.loggedin,
      user: data,
      res: req.query.res
    });
  });
});

app.get('/logout', function(req, res) {
  var cookie = getCookie(req);

  req.session.destroy();
  deleteCookies(res);
  db.deleteSession(cookie.username, cookie.sid);

  res.redirect('/login');
});

// ===== POST Callbacks ===== //
app.post('/auth', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var url = req.body.url;
  url = url ? url : '/home';

  console.log('Login ');
  console.log({
    username: username,
    password: '***',
    url: url
  });

  db.auth(username, password).then((success) => {
    if (success) {
      req.session.loggedin = true;
      req.session.username = username;

      db.createSession(username).then((user) => {
        setCookie(res, {
          username: user.username,
          sid: user.sid,
          token: user.token
        });
      }).then(() => {
        res.redirect(`/${url}`);
      });
    } else {
      res.redirect(`/login?url=${url}&nope=Access denied : (`);
    }
  });
});

app.post('/register', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var tan = req.body.tan;

  if (username && password && tanlist.check(tan)) {
    console.log(`
              Register "${username}"
              `);

    db.createUser(username, password).then(() => {
      req.session.loggedin = true;
      req.session.username = username;
      res.redirect('/home');
    }).catch(err => {
      res.redirect('/register?nope=Benutzername schon vergeben');
    });
  } else {
    res.redirect('/register?nope=Falsche TAN');
  }
});

app.post('/update-name', function(req, res) {
  if (!loggedin(req, res, 'update-name')) return;

  var old_username = req.session.username;
  var new_username = req.body.username;

  db.exists(new_username).then((exists) => {
    if (!exists) return db.updateUser(old_username, 'name', new_username);
    else throw new Error('Benutzername schon vergebem');
  }).then(() => {
    req.session.username = new_username;

    setCookie(res, {
      username: new_username
    });

    return db.renameSession(old_username, new_username);
  }).then(() => {
    res.redirect(` / profile ? res = Benutzername geändert zu $ {
                new_username
              }
              `);
  }).catch((msg) => {
    res.redirect(` / profile ? res = $ {
                msg
              }
              `);
  });
});

app.post('/update-data', function(req, res) {
  if (!loggedin(req, res, 'update-data')) return;

  var username = req.session.username;
  var new_data = req.body.data;

  db.updateUser(username, 'data', new_data).then(() => {
    res.redirect(` / profile ? res = Beschreibung geändert `);
  });
});

app.post('/update-pswd', function(req, res) {
  if (!loggedin(req, res, 'update-pswd')) return;

  var username = req.session.username;
  var old_password = req.body.password_old;
  var new_password = req.body.password_new;

  db.getUserData(username).then((data) => {
    if (hash.compare(old_password, data.password)) {
      db.updateUser(username, 'password', new_password).then(() => {
        res.redirect(` / profile ? res = Passwort geändert `);
      });
    } else {
      res.redirect(` / profile ? res = Falsches Passwort `);
    }
  });
});

app.post('/del-account', function(req, res) {
  if (!loggedin(req, res, 'del-account')) return;

  var username = req.session.username;
  var password = req.body.password;

  db.getUserData(username).then((data) => {
    if (hash.compare(password, data.password)) {
      db.deleteUser(username).then(() => {
        res.redirect(` / logout `);
      });
    } else {
      res.redirect(` / profile ? res = Falsches Passwort `);
    }
  });
});