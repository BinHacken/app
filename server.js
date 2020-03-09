// =========== Globals ========== //
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const db = require('./data.js');
const crypto = require('crypto');
const tanlist = require('./tan.js');

const app = express();
const waitForDBtoInit = db.init();

const args = process.argv.slice(2);

// ===== Helper functions ===== //
function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function check_login(req, res) {
  if (req.session.loggedin) {
    return true;
  } else {
    res.redirect('/login');
    return false;
  }
}

// ===== Express App ===== //
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true,
  cookie: {}
}));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

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
  res.render('login', {
    nope: req.query.nope,
    loggedin: req.session.loggedin
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
  if (check_login(req, res)) {
    res.render('home', {
      loggedin: req.session.loggedin
    });
  }
});

app.get('/users', function(req, res) {
  if (check_login(req, res)) {
    db.getUserList().then((data) => {
      res.render('users', {
        loggedin: req.session.loggedin,
        users: data
      });
    });
  }
});

app.get('/profile', function(req, res) {
  if (check_login(req, res)) {
    db.getUserData(req.session.username).then((data) => {
      res.render('profile', {
        loggedin: req.session.loggedin,
        user: data,
        res: req.query.res
      });
    });
  }
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

// ===== POST Callbacks ===== //
app.post('/auth', function(req, res) {
  var username = req.body.username;
  var password = hash(req.body.password);

  console.log(`Login "${username}","${password}"`);

  db.auth(username, password).then((success) => {
    if (success) {
      req.session.loggedin = true;
      req.session.username = username;
      res.redirect('/home');
    } else {
      res.redirect('/login?nope=Access denied :(');
    }
  });
});

app.post('/register', function(req, res) {
  var username = req.body.username;
  var password = hash(req.body.password);
  var tan = hash(req.body.tan);

  if (username && password && tanlist.check(tan)) {
    console.log(`Register "${username}","${password}"`);

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
  if (check_login(req, res)) {
    var old_username = req.session.username;
    var new_username = req.body.username;

    db.exists(new_username).then((exists) => {
      if (!exists) {
        db.updateUser(old_username, 'name', new_username).then(() => {
          req.session.username = new_username;
          res.redirect(`/profile?res=Benutzername geändert zu ${new_username}`);
        });
      } else {
        res.redirect(`/profile?res=Benutzername schon vergeben`);
      }
    });
  }
});

app.post('/update-data', function(req, res) {
  if (check_login(req, res)) {
    var username = req.session.username;
    var new_data = req.body.data;

    db.updateUser(username, 'data', new_data).then(() => {
      res.redirect(`/profile?res=Beschreibung geändert`);
    });
  }
});

app.post('/update-pswd', function(req, res) {
  if (check_login(req, res)) {
    var username = req.session.username;
    var old_password = hash(req.body.password_old);
    var new_password = hash(req.body.password_new);

    db.getUserData(username).then((data) => {
      if (data.password == old_password) {
        db.updateUser(username, 'password', new_password).then(() => {
          res.redirect(`/profile?res=Passwort geändert`);
        });
      } else {
        res.redirect(`/profile?res=Falsches Passwort`);
      }
    });
  }
});

app.post('/del-account', function(req, res) {
  if (check_login(req, res)) {
    var username = req.session.username;
    var password = hash(req.body.password);

    db.getUserData(username).then((data) => {
      if (data.password == password) {
        db.deleteUser(username).then(() => {
          res.redirect(`/logout`);
        });
      } else {
        res.redirect(`/profile?res=Falsches Passwort`);
      }
    });
  }
});