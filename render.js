const db = require('./db.js');
const auth = require('./auth.js');

function home(req, res) {
  db.getLinks().then(links => {
    db.getMessages().then(messages => {
      res.render('home', {
        loggedin: req.session.loggedin,
        links: links,
        messages: messages
      });
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
  db.getProjectList().then((data) => {
    res.render('projects', {
      loggedin: req.session.loggedin,
      projects: data,
      res: req.query.res,
      userId: req.session.userId
    });
  });
}

function project(req, res, projectId) {
  return db.getProject({
    'id': projectId
  }).then(project => {
    if (project) {
      return res.render('project', {
        loggedin: req.session.loggedin,
        project: project,
        res: undefined
      });
    } else {
      throw new Error(`Project ${projectId} not found`);
    }
  });
}

function links(req, res) {
  db.getLinks().then((data) => {
    return res.render('links', {
      loggedin: req.session.loggedin,
      links: data,
      res: req.query.res
    });
  });
}

function tokens(req, res) {
  db.getTokens().then((data) => {
    return res.render('tokens', {
      loggedin: req.session.loggedin,
      tokens: data,
      res: req.query.res
    });
  });
}

function profile(req, res) {
  db.getUser({
    'id': req.session.userId
  }).then((data) => {
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
  project,
  links,
  tokens,
  profile
};