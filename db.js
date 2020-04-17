// ========== Imports ========== //
const md = require('markdown-it')().disable(['html_inline', 'image']);
const hash = require('./hash.js');
const crypto = require('crypto');

const {
  Sequelize,
  Model,
  DataTypes
} = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './private/bindata.db'
});

// ========== Tables ========== //
const User = sequelize.define('user', {
  name: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    set(value) {
      this.setDataValue('password', hash.make(value));
    }
  },
  data: {
    type: DataTypes.TEXT,
    set(value) {
      this.setDataValue('data', value.substring(0, 2048));
    }
  },
  html: {
    type: DataTypes.VIRTUAL(DataTypes.TEXT, ['data']),
    get() {
      return md.render(`${this.data}`);
    },
    set(value) {
      throw new Error('Do not try to set the `html` value!');
    }
  }
}, {
  // Options
});

const Session = sequelize.define('session', {
  sid: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  // Options
});

const Link = sequelize.define('link', {
  name: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  url: {
    type: DataTypes.STRING(512),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  // Options
});

const Project = sequelize.define('project', {
  name: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    set(value) {
      this.setDataValue('data', value.substring(0, 2048));
    }
  },
  html: {
    type: DataTypes.VIRTUAL(DataTypes.TEXT, ['description']),
    get() {
      return md.render(`${this.description}`);
    },
    set(value) {
      throw new Error('Do not try to set the `html` value!');
    }
  }
}, {
  // Options
});

const Todo = sequelize.define('todo', {
  description: {
    type: DataTypes.STRING(512),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  // Options
});

const Token = sequelize.define('token', {
  data: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  // Options
});
// ========== Relationships ========== //

User.hasMany(Session, {
  as: 'sessions',
  onDelete: 'CASCADE'
});
Session.belongsTo(User);

User.hasMany(Link, {
  as: 'links',
  onDelete: 'SET NULL'
});
Link.belongsTo(User);

User.hasMany(Token, {
  as: 'tokens',
  onDelete: 'CASCADE'
});
Token.belongsTo(User);

Project.belongsToMany(User, {
  through: 'ProjectMaintainers',
  as: 'maintainers'
});
User.belongsToMany(Project, {
  through: 'ProjectMaintainers',
  as: 'projects'
});

Project.hasMany(Todo, {
  as: 'todos',
  onDelete: 'SET NULL'
});
Todo.belongsTo(Project);

Todo.belongsTo(User);
User.hasMany(Todo, {
  as: 'todos',
  onDelete: 'SET NULL'
});

// ========== Functions ========== //
function init(alter) {
  return sequelize.authenticate().then(() => {
    return sequelize.sync({
      alter: alter
    });
  }).then(() => {
    // remove old sessions
    return sequelize.query("DELETE FROM `sessions` WHERE `date` <= date('now','-30 day')", {
      raw: true
    });
  }).then(() => {
    // remove old tokens
    return sequelize.query("DELETE FROM `tokens` WHERE `date` <= date('now','-30 day')", {
      raw: true
    });
  }).then(() => {
    console.log('DB connected');
  }).catch(err => {
    console.error('Unable to connect: ', err);
  });
}

// ===== User ===== //
function createUser(username, password) {
  return User.create({
    name: username,
    password: password
  });
};

function getUser(data) {
  if (data['id'] && data['password']) {
    return User.findOne({
      where: {
        id: data['id'],
        password: hash.make(data['password'])
      }
    });
  } else if (data['name'] && data['password']) {
    return User.findOne({
      where: {
        name: data['name'],
        password: hash.make(data['password'])
      }
    });
  } else if (data['id']) {
    return User.findOne({
      where: {
        id: data['id']
      }
    });

  } else if (data['name']) {
    return User.findOne({
      where: {
        name: data['name']
      }
    });
  }
}

function getUserList() {
  return User.findAll({
    attributes: ['name', 'html']
  });
}

function updateUser(userId, field, value) {
  return getUser({
    'id': userId
  }).then(user => {
    user.set(field, value);
    return user.save();
  });
}

function deleteUser(userId) {
  return User.destroy({
    where: {
      id: userId
    }
  });
}

// ===== Session ===== //

function createSession(userId) {
  var sid = crypto.randomBytes(16).toString('hex');
  var token = crypto.randomBytes(16).toString('hex');

  return Session.create({
    sid: sid,
    token: token,
    userId: userId
  });
};

function authSession(sid, token, userId) {
  // find sessions
  return Session.findOne({
    where: {
      sid: sid,
      token: token,
      userId: userId
    }
  }).then((session) => {
    // found => update token
    if (session) {
      console.log("Found session!");
      console.log("Upading token...");

      var newtoken = crypto.randomBytes(16).toString('hex');
      session.set("token", newtoken);

      return session.save();
    }

    // not found => remove all sessions with sid
    else {
      console.log("Session not found!");
      console.log("Deleting all sessions with that SID");

      return Session.destroy({
        where: {
          sid: sid
        }
      });
    }
  });
};

function deleteSession(sid, userId) {
  return Session.destroy({
    where: {
      sid: sid,
      userId: userId
    }
  });
};

// ===== Link ===== //
function createLink(name, url, userId) {
  return Link.create({
    name: name,
    url: url,
    userId: userId
  });
}

function getLinks() {
  return Link.findAll();
}

function deleteLink(name, url) {
  return Link.destroy({
    where: {
      name: name,
      url: url
    }
  });
}

// ===== Project ====== //

function createProject(name, userId) {
  return Project.create({
    where: {
      name: name
    },
    include: User
  }).then(project => {
    return project.maintainers.findOrCreate({
      where: {
        userId: userId
      }
    });
  });
}

function getProjects() {
  return Project.findAll({
    include: [{
      model: User,
      as: 'maintainers'
    }, {
      model: Todo,
      as: 'todos'
    }]
  });
}

function editProject(id, name, description) {
  return Project.update({
    name: name,
    description: description
  }, {
    where: {
      id: id
    }
  });
}

function createMaintainer(projectId, userId) {
  return Project.findOne({
    where: {
      projectId: projectId
    },
    include: User
  }).then(project => {
    if (project) {
      return project.maintainers.findOrCreate({
        where: {
          userId: userId
        }
      });
    } else {
      throw new console.error("Project nicht gefunden");
    }
  });
}

function deleteProject(projectId) {
  return Project.destroy({
    where: {
      id: projectId
    }
  });
}

function createTodo(projectId, description, userId) {
  return Todo.create({
    description: description,
    projectId: projectId,
    userId: userId
  });
}

function deleteProjectTodo(todoId) {
  return Todo.destroy({
    where: {
      id: todoId
    }
  });
}

function createToken(userId, token) {
  return Token.count({
    where: {
      userId: userId
    }
  }).then(result => {
    if (result > 150) {
      Token.destroy({
        where: {
          userId: userId
        }
      });
    }
  }).then(() => {
    return Token.create({
      data: token,
      userId: userId
    });
  })
}

module.exports = {
  init,
  createUser,
  getUser,
  getUserList,
  updateUser,
  deleteUser,
  createSession,
  authSession,
  deleteSession,
  createLink,
  getLinks,
  deleteLink,
  createProject,
  getProjects,
  editProject,
  createMaintainer,
  deleteProject,
  createTodo,
  deleteProjectTodo,
  createToken
};