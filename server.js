// =========== Globals ========== //
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const db = require('./db.js');
const hash = require('./hash.js');
const cookie = require('./cookie.js');
const auth = require('./auth.js');
const render = require('./render.js');

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

// ===== User ===== //
app.get('/', function(req, res) {
  res.redirect('/home');
});

app.get('/home', function(req, res) {
  if (!auth.checkLogin(req, res, 'home')) return;
  render.home(req, res);
});

app.get('/login', function(req, res) {
  let url = req.query.url ? req.query.url : 'home';

  let success = () => {
    res.redirect(`/${url}`);
  };

  let fail = () => {
    render.login(req, res);
  };

  auth.createSession(req, res).then(success).catch(fail);
});

app.get('/register', function(req, res) {
  render.register(req, res);
});

app.get('/users', function(req, res) {
  if (!auth.checkLogin(req, res, 'users')) return;
  render.users(req, res);
});

app.get('/projects', function(req, res) {
  if (!auth.checkLogin(req, res, 'projects')) return;
  render.projects(req, res);
});

app.get('/links', function(req, res) {
  if (!auth.checkLogin(req, res, 'links')) return;
  render.links(req, res);
});

app.get('/profile', function(req, res) {
  if (!auth.checkLogin(req, res, 'profile')) return;
  render.profile(req, res);
});

app.get('/logout', function(req, res) {
  let _cookie = cookie.get(req);

  req.session.destroy();
  cookie.clear(res);
  db.deleteSession(_cookie.username, _cookie.sid);

  res.redirect('/login');
});

// ===== GET API ===== //
app.get('/del-link', function(req, res) {
  if (!auth.checkLogin(req, res, 'links')) return;

  let name = req.query.name;
  let url = req.query.url;

  db.deleteLink(name, url).then(() => {
    res.redirect(`/links`);
  }).catch(err => {
    res.redirect('/links?nope=Something fucked up');
  });
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

// ===== POST API ===== //
app.post('/auth', function(req, res) {
  let username = req.body.username;
  let password = req.body.password;
  let url = req.body.url ? req.body.url : 'home';

  console.log('Login');
  console.log({
    username: username,
    password: '***',
    url: url
  });

  auth.login(req, res, username, password).then(() => {
    res.redirect(`/${url}`);
  }).catch(() => {
    res.redirect(`/login?url=${url}&nope=Access denied : (`);
  });
});

app.post('/register', function(req, res) {
  let username = req.body.username;
  let password = req.body.password;
  let tan = req.body.tan;

  console.log(`Register "${username}"`);

  auth.register(req, res, username, password, tan).then(() => {
    res.redirect('/home');
  }).catch((msg) => {
    res.redirect(`/register?nope=${msg}`);
  });
});

app.post('/update-name', function(req, res) {
  if (!auth.checkLogin(req, res, 'update-name')) return;

  let old_username = req.session.username;
  let new_username = req.body.username;

  auth.rename(req, res, old_username, new_username).then(() => {
    res.redirect(`/profile?res=Benutzername geändert zu ${new_username}`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.post('/update-data', function(req, res) {
  if (!auth.checkLogin(req, res, 'update-data')) return;

  let username = req.session.username;
  let new_data = req.body.data;

  db.updateUser(username, 'data', new_data).then(() => {
    res.redirect(`/profile?res=Beschreibung geändert`);
  }).catch((msg) => {
    res.redirect(`/profile?res=Da ist etwas schief gelaufen (${msg})`);
  });
});

app.post('/update-pswd', function(req, res) {
  if (!auth.checkLogin(req, res, 'update-pswd')) return;

  let username = req.session.username;
  let old_password = req.body.password_old;
  let new_password = req.body.password_new;

  db.getUserData(username).then((current) => {
    if (!hash.compare(old_password, current.password)) {
      throw new Error('Falsches Passwort');
    };
  }).then(() => {
    db.updateUser(username, 'password', new_password);
  }).then(() => {
    res.redirect(`/profile?res=Passwort geändert`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.post('/del-account', function(req, res) {
  if (!auth.checkLogin(req, res, 'del-account')) return;

  let username = req.session.username;
  let password = req.body.password;

  db.getUserData(username).then((current) => {
    if (!hash.compare(password, current.password)) {
      throw new Error('Falsches Passwort');
    };
  }).then(() => {
    db.deleteUser(username);
  }).then(() => {
    res.redirect(`/logout`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.post('/add-link', function(req, res) {
  if (!auth.checkLogin(req, res, 'links')) return;

  let username = req.session.username;
  let name = req.body.name;
  let url = req.body.url;

  db.createLink(name, url, username).then(success = () => {
    res.redirect('/links');
  }).catch((msg) => {
    res.redirect(`/links?nope=${msg}`);
  });
});

// ===== 404 ===== //
app.get('*', function(req, res) {
  res.status(404).send('File not found').end();
});