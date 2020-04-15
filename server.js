// =========== Globals ========== //
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const db = require('./db.js');
const tanlist = require('./tan.js');
const hash = require('./hash.js');
const cookie = require('./cookie.js');
const auth = require('./auth.js');

const app = express();
const waitForDBtoInit = db.init();

const args = process.argv.slice(2);

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
  var url = req.query.url ? req.query.url : '/home';

  if (req.session.loggedin) {
    res.redirect(`/${url}`);
    return;
  }

  var _cookie = cookie.get(req);

  var renderPage = function() {
    res.render('login', {
      nope: req.query.nope,
      loggedin: req.session.loggedin,
      url: url
    });
  }

  if (!_cookie.username || !_cookie.sid || !_cookie.token) {
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
  db.authSession(_cookie.username, _cookie.sid, _cookie.token).then((session) => {
    if (session && session.token) {
      console.log("Authenticated!");
      console.log(`Setting new token ${session.token}`);

      cookie.set(res, {
        token: session.token
      });

      req.session.loggedin = true;
      req.session.username = _cookie.username;

      res.redirect(`/${url}`);
    } else {
      cookie.clear(res);
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
  if (!auth.auth.checkLogin(req, res, 'home')) return;

  db.getLinks().then((links) => {
    res.render('home', {
      loggedin: req.session.loggedin,
      links: links
    });
  });
});

app.get('/users', function(req, res) {
  if (!auth.checkLogin(req, res, 'users')) return;

  db.getUserList().then((data) => {
    res.render('users', {
      loggedin: req.session.loggedin,
      users: data
    });
  });
});

app.get('/projects', function(req, res) {
  if (!auth.checkLogin(req, res, 'projects')) return;

  db.getProjects().then((data) => {
    res.render('projects', {
      loggedin: req.session.loggedin,
      projects: data
    });
  });
});

app.get('/links', function(req, res) {
  if (!auth.checkLogin(req, res, 'links')) return;

  db.getLinks().then((data) => {
    return res.render('links', {
      loggedin: req.session.loggedin,
      links: data
    });
  });
});

app.get('/del-link', function(req, res) {
  if (!auth.checkLogin(req, res, 'links')) return;

  var name = req.query.name;
  var url = req.query.url;

  console.log(name);
  console.log(url);

  db.deleteLink(name, url).then(() => {
    res.redirect(`/links`);
  }).catch(err => {
    res.redirect('/links?nope=Something fucked up');
  });
});

app.get('/profile', function(req, res) {
  if (!auth.checkLogin(req, res, 'profile')) return;

  db.getUserData(req.session.username).then((data) => {
    res.render('profile', {
      loggedin: req.session.loggedin,
      user: data,
      res: req.query.res
    });
  });
});

app.get('/logout', function(req, res) {
  var _cookie = cookie.get(req);

  req.session.destroy();
  cookie.clear(res);
  db.deleteSession(_cookie.username, _cookie.sid);

  res.redirect('/login');
});

app.get('/token', function(req, res) {

  if (!req.session.loggedin || !req.query.data) {
    res.status(404).send('File not found').end();
  } else {
    db.addToken(req.session.username, req.query.data).then(() => {
      res.status(200).send('OK').end();
    });
  }
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
        cookie.set(res, {
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
    console.log(`Register "${username}"`);

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
  if (!auth.checkLogin(req, res, 'update-name')) return;

  var old_username = req.session.username;
  var new_username = req.body.username;

  db.exists(new_username).then((exists) => {
    if (!exists) return db.updateUser(old_username, 'name', new_username);
    else throw new Error('Benutzername schon vergebem');
  }).then(() => {
    req.session.username = new_username;

    cookie.set(res, {
      username: new_username
    });

    return db.renameSession(old_username, new_username);
  }).then(() => {
    res.redirect(`/profile?res=Benutzername geändert zu $ {new_username}`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.post('/update-data', function(req, res) {
  if (!auth.checkLogin(req, res, 'update-data')) return;

  var username = req.session.username;
  var new_data = req.body.data;

  db.updateUser(username, 'data', new_data).then(() => {
    res.redirect(`/profile?res=Beschreibung geändert`);
  });
});

app.post('/update-pswd', function(req, res) {
  if (!auth.checkLogin(req, res, 'update-pswd')) return;

  var username = req.session.username;
  var old_password = req.body.password_old;
  var new_password = req.body.password_new;

  db.getUserData(username).then((data) => {
    if (hash.compare(old_password, data.password)) {
      db.updateUser(username, 'password', new_password).then(() => {
        res.redirect(`/profile?res=Passwort geändert`);
      });
    } else {
      res.redirect(`/profile?res=Falsches Passwort`);
    }
  });
});

app.post('/del-account', function(req, res) {
  if (!auth.checkLogin(req, res, 'del-account')) return;

  var username = req.session.username;
  var password = req.body.password;

  db.getUserData(username).then((data) => {
    if (hash.compare(password, data.password)) {
      db.deleteUser(username).then(() => {
        res.redirect(`/logout`);
      });
    } else {
      res.redirect(`/profile?res=Falsches Passwort`);
    }
  });
});

app.post('/add-link', function(req, res) {
  if (!auth.checkLogin(req, res, 'links')) return;

  var username = req.session.username;
  var name = req.body.name;
  var url = req.body.url;

  db.createLink(name, url, username).then(() => {
    res.redirect('/links');
  }).catch(err => {
    res.redirect('/links?nope=Something fucked up');
  });
});