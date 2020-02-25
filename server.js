const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const db = require('./data.js');
const crypto = require('crypto');

const app = express();
/*
const waitForDBtoInit = db.init();

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
//var hash = crypto.createHash('sha256').update('tobehashed').digest('hex');
//console.log(hash);

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

app.get('/login', function(req, res) {
  res.render('login', {
    nope: req.query.nope,
    loggedin: req.session.loggedin
  });
});

app.get('/home', function(req, res) {
  if (check_login(req, res)) {
    res.render('home', {
      loggedin: req.session.loggedin
    });
  }
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.post('/auth', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  console.log(`Login "${username}","${password}"`);

  if (username && password) {
    // DB magic
    if (username == 'Axt' && password == 'hacker') {
      req.session.loggedin = true;
      req.session.username = username;
      res.redirect('/home');
    } else {
      res.redirect('/login?nope=Access denied :(');
    }
  } else {
    res.redirect('/login?nope=No username or password');
  }
});

app.listen(80, function() {
  console.log('Server started');
});