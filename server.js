// =========== Globals ========== //
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const db = require('./db.js');
const cookie = require('./cookie.js');
const auth = require('./auth.js');
const render = require('./render.js');
const push = require('./push.js');

const args = process.argv.slice(2);

const app = express();
const waitForDBtoInit = db.init(args.includes('alter'));

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
app.get('/', (req, res) => {
  res.redirect('/home');
});

app.get('/home', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.home(req, res);
});

app.get('/login', (req, res) => {
  let url = req.query.url ? req.query.url : 'home';

  auth.startSession(req, res).then(() => {
    res.redirect(`/${url}`);
  }).catch(() => {
    render.login(req, res);
  });
});

app.get('/users', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.users(req, res);
});

app.get('/projects', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.projects(req, res);
});

app.get('/project', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.project;

  db.isMaintainer(projectId, req.session.userId).then(pm => {
    if (pm) {
      return render.project(req, res, projectId);
    } else {
      throw new Error(`Keine Rechte dieses Project zu Bearbeiten`);
    }
  }).catch(msg => {
    res.redirect(`/projects?res=${msg}`);
  });
});

app.get('/links', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.links(req, res);
});

app.get('/tokens', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.tokens(req, res);
});

app.get('/messages', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.messages(req, res);
});

app.get('/profile', (req, res) => {
  if (!auth.checkLogin(req, res)) return;
  render.profile(req, res);
});

app.get('/logout', (req, res) => {
  let _cookie = cookie.get(req);

  req.session.destroy();
  cookie.clear(res);
  db.deleteSession(_cookie.sid, _cookie.userId);

  res.redirect('/login');
});

// ===== GET API ===== //
app.get('/del-link', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let name = req.query.name.trim();
  let url = req.query.url;

  db.deleteLink(name, url).then(() => {
    res.redirect(`/links`);
  }).catch(err => {
    res.redirect('/links?nope=Something fucked up');
  });
});

app.get('/token', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  db.createToken(req.session.userId, req.query.data).then(() => {
    res.redirect('/home');
  });
});

app.get('/del-token', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let tokenId = req.query.id;

  db.deleteToken(tokenId).then(() => {
    res.redirect(`/tokens`);
  });
});

app.get('/auth', (req, res) => {
  let username = req.query.username.trim();
  let password = req.query.password;
  let url = req.query.url ? req.query.url : 'home';

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

app.get('/register', (req, res) => {
  let username = req.query.username.trim();
  let password = req.query.password;
  let tan = req.query.tan;

  console.log(`Register "${username}"`);

  auth.register(req, res, username, password, tan).then(() => {
    return auth.login(req, res, username, password);
  }).then(() => {
    res.redirect('/home');
  }).catch((msg) => {
    res.redirect(`/register?nope=${msg}`);
  });
});

app.get('/update-name', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let new_username = req.query.username;

  auth.rename(req, res, req.session.userId, new_username).then(() => {
    res.redirect(`/profile?res=Benutzername geändert zu ${new_username}`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.get('/update-data', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let new_data = req.query.data;

  db.updateUser(req.session.userId, 'data', new_data).then(() => {
    res.redirect(`/profile?res=Beschreibung geändert`);
  }).catch((msg) => {
    res.redirect(`/profile?res=Da ist etwas schief gelaufen (${msg})`);
  });
});

app.get('/update-pswd', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let old_password = req.query.password_old;
  let new_password = req.query.password_new;

  db.getUser({
    'id': req.session.userId,
    'password': old_password
  }).then(user => {
    if (user) {
      db.updateUser(req.session.userId, 'password', new_password);
    } else {
      throw new Error('Falsches Passwort');
    };
  }).then(() => {
    res.redirect(`/profile?res=Passwort geändert`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.get('/del-account', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let password = req.query.password;

  db.getUser({
    'id': req.session.userId,
    'password': password
  }).then(user => {
    if (user) {
      db.deleteUser(user.id);
    } else {
      throw new Error('Falsches Passwort');
    };
  }).then(() => {
    res.redirect(`/logout`);
  }).catch((msg) => {
    res.redirect(`/profile?res=${msg}`);
  });
});

app.get('/add-link', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let name = req.query.name.trim();
  let url = req.query.url;

  db.createLink(name, url, req.session.userId).then(() => {
    res.redirect('/links?res=Link erstellt');
  }).catch((msg) => {
    res.redirect(`/links?res=${msg}`);
  });
});

app.get('/new-project', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let name = req.query.name.trim();

  db.getProject({
    'name': name
  }).then(project => {
    if (project) {
      throw new Error('Project existiert bereits');
    } else {
      return db.createProject(name);
    }
  }).then(project => {
    return db.createMaintainer(project.id, req.session.userId);
  }).then(pm => {
    res.redirect(`/project?project=${pm.projectId}`);
  }).catch(msg => {
    res.redirect(`/projects?res=${msg}`);
  });
});

app.get('/new-msg', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let msg = req.query.msg.trim();

  db.createMessage(msg, req.session.userId).then(() => {
    res.redirect('/home');
  }).then(() => {
    return db.getTokens();
  }).then(tokens => {
    tokens.forEach(token => {
      push.send(msg, token.data).catch(() => {
        db.deleteToken(token.id);
      });
    });
  })
});

app.get('/del-msg', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let msgId = req.query.id;

  db.deleteMessage(msgId).then(() => {
    res.redirect('/messages');
  });
});

app.get('/update-project-name', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.projectId;
  let name = req.query.name;

  db.isMaintainer(projectId, req.session.userId).then(hasAccess => {
    if (!hasAccess) throw new Error("Keine Zugriffsrechte auf dieses Projekt");
    else return db.updateProject(projectId, 'name', name);
  }).then(() => {
    res.redirect(`/project?project=${projectId}&res=Name geändert`);
  }).catch(msg => {
    res.redirect(`/project?project=${projectId}&res=${msg}`);
  });
});

app.get('/update-project-description', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.projectId;
  let description = req.query.description;

  db.isMaintainer(projectId, req.session.userId).then(hasAccess => {
    if (!hasAccess) throw new Error("Keine Zugriffsrechte auf dieses Projekt");
    else return db.updateProject(projectId, 'description', description);
  }).then(() => {
    res.redirect(`/project?project=${projectId}&res=Beschreibung geändert`);
  }).catch(msg => {
    res.redirect(`/project?project=${projectId}&res=${msg}`);
  });
});

app.get('/add-maintainer', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.projectId;
  let maintainer = req.query.maintainer;

  db.isMaintainer(projectId, req.session.userId).then(hasAccess => {
    if (!hasAccess) throw new Error("Keine Zugriffsrechte auf dieses Projekt");
    else return db.getUser({
      'name': maintainer
    });
  }).then(user => {
    if (!user) throw new Error('Benutzer konnte nicht gefunden werden');
    else return db.createMaintainer(projectId, user.id);
  }).then(() => {
    res.redirect(`/project?project=${projectId}&res=Maintainer hinzugefügt`);
  }).catch((msg) => {
    res.redirect(`/project?project=${projectId}&res=${msg}`);
  });
});

app.get('/add-todo', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.projectId;
  let description = req.query.description;

  db.isMaintainer(projectId, req.session.userId).then(hasAccess => {
    if (!hasAccess) throw new Error("Keine Zugriffsrechte auf dieses Projekt");
    else return db.createTodo(projectId, description);
  }).then(() => {
    res.redirect(`/project?project=${projectId}&res=Todo hinzugefügt`);
  }).catch((msg) => {
    res.redirect(`/project?project=${projectId}&res=${msg}`);
  });
});

app.get('/del-todo', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.projectId;
  let todoId = req.query.id;

  db.isMaintainer(projectId, req.session.userId).then(hasAccess => {
    if (!hasAccess) throw new Error("Keine Zugriffsrechte auf dieses Projekt");
    else return db.deleteProjectTodo(todoId);
  }).then(() => {
    res.redirect(`/project?project=${projectId}&res=Todo gelöscht`);
  }).catch((msg) => {
    res.redirect(`/project?project=${projectId}&res=${msg}`);
  });
});

app.get('/del-project', (req, res) => {
  if (!auth.checkLogin(req, res)) return;

  let projectId = req.query.projectId;

  db.isMaintainer(projectId, req.session.userId).then(hasAccess => {
    if (!hasAccess) throw new Error("Keine Zugriffsrechte auf dieses Projekt");
    else return db.deleteProject(projectId);
  }).then(() => {
    res.redirect(`/projects?res=Projekt gelöscht`);
  }).catch((msg) => {
    res.redirect(`/projects?res=${msg}`);
  });
});

// ===== 404 ===== //
app.get('*', (req, res) => {
  res.status(404).send('File not found').end();
});