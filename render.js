const db = require('./db.js');
const auth = require('./auth.js');

function home(req, res) {
  db.getLinks().then((links) => {
    res.render('home', {
      loggedin: req.session.loggedin,
      links: links
    });
  });
}

function login(req, res) {
  let url = req.query.url ? req.query.url : 'home';

  res.render('login', {
    nope: req.query.nope,
    loggedin: req.session.loggedin,
    url: url
  });
}

function register(req, res) {
  res.render('register', {
    nope: req.query.nope,
    loggedin: req.session.loggedin,
    tan: req.query.tan
  });
}

function users(req, res) {
  db.getUserList().then((data) => {
    res.render('users', {
      loggedin: req.session.loggedin,
      users: data
    });
  });
}

function projects(req, res) {
  db.getProjects().then((data) => {
    res.render('projects', {
      loggedin: req.session.loggedin,
      projects: data
    });
  });
}

function links(req, res) {
  db.getLinks().then((data) => {
    return res.render('links', {
      loggedin: req.session.loggedin,
      links: data
    });
  });
}

function profile(req, res) {
  db.getUserData(req.session.username).then((data) => {
    res.render('profile', {
      loggedin: req.session.loggedin,
      user: data,
      res: req.query.res
    });
  });
}

module.exports = {
  home,
  login,
  register,
  users,
  projects,
  links,
  profile
};