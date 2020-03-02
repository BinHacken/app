const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const db = require('./data.js');
const crypto = require('crypto');
const tanlist = require('./tan.js');

const app = express();
const waitForDBtoInit = db.init();
/*
db.createUser('Spacehuhn', 'whatever').then(() => {
  db.auth('Spacehuhn', 'singlequotes').then(result => {
    console.log(result);
  }).then(() => {
    db.auth('Spacehuhn', 'whatever').then(result => {
      console.log(result);
    });
  });
});
*/

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

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

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

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(80, function() {
  console.log('Server started');
});