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
var hash = crypto.createHash('sha256').update('tobehashed').digest('hex');
console.log(hash);

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

app.get('/login', function(req, res) {
  res.render('login', {
    nope: req.query.nope
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.post('/auth', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  console.log('Login request:');
  console.log(`Username: "${username}"`);
  console.log(`Password: "${password}"`);

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
    res.send('No username or password');
  }
  res.end();
});

app.get('/home', function(req, res) {
  if (req.session.loggedin) {
    res.render('home');
  } else {
    res.redirect('/login');
  }
  res.end();
});

app.listen(80, function() {
  console.log('Server started');
});