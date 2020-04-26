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
  timestamps: false
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
  timestamps: false
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
  timestamps: false
});

const Project = sequelize.define('project', {
  name: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    set(value) {
      this.setDataValue('description', value.substring(0, 2048));
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
  timestamps: false
});

const ProjectMaintainers = sequelize.define('ProjectMaintainers', {}, {
  timestamps: false
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
  timestamps: false
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
  timestamps: false
});

const Message = sequelize.define('message', {
  data: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  shortdate: {
    type: DataTypes.VIRTUAL(DataTypes.STRING, ['shortdate']),
    get() {
      return `${this.date}`.substring(0, 21);
    },
    set(value) {
      throw new Error('Do not try to set the `shortdate` value!');
    }
  }
}, {
  timestamps: false
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

User.hasMany(Message, {
  as: 'messages',
  onDelete: 'CASCADE'
});
Message.belongsTo(User);

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
  if (data.hasOwnProperty('id') && data.hasOwnProperty('password')) {
    return User.findOne({
      where: {
        id: data['id'],
        password: hash.make(data['password'])
      }
    });
  } else if (data.hasOwnProperty('name') && data.hasOwnProperty('password')) {
    return User.findOne({
      where: {
        name: data['name'],
        password: hash.make(data['password'])
      }
    });
  } else if (data.hasOwnProperty('id')) {
    return User.findOne({
      where: {
        id: data['id']
      }
    });
  } else if (data.hasOwnProperty('name')) {
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

function createProject(name) {
  return Project.create({
    name: name
  });
}

function getProject(data) {
  if (data.hasOwnProperty('name')) {
    return Project.findOne({
      where: {
        name: data['name']
      },
      include: [{
        model: User,
        as: 'maintainers'
      }, {
        model: Todo,
        as: 'todos'
      }]
    });
  } else if (data.hasOwnProperty('id')) {
    return Project.findOne({
      where: {
        id: data['id']
      },
      include: [{
        model: User,
        as: 'maintainers'
      }, {
        model: Todo,
        as: 'todos'
      }]
    });
  }
}

function getProjectList() {
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

function updateProject(projectId, field, value) {
  return getProject({
    'id': projectId
  }).then(project => {
    project.set(field, value);
    return project.save();
  });
}

function deleteProject(projectId) {
  return Project.destroy({
    where: {
      id: projectId
    }
  });
}

// ===== Maintainer ===== //
function createMaintainer(projectId, userId) {
  return isMaintainer(projectId, userId).then(maintainer => {
    if (maintainer) throw new Error('Ist bereits Maintainer');
    else {
      return ProjectMaintainers.create({
        projectId: projectId,
        userId: userId
      });
    }
  });
}

function isMaintainer(projectId, userId) {
  return ProjectMaintainers.findOne({
    where: {
      projectId: projectId,
      userId: userId
    }
  });
}

// ===== Todo ==== //
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

// ===== Token ===== //
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
    return Token.count({
      where: {
        userId: userId,
        data: token
      }
    })
  }).then(found => {
    if (found == 0) {
      return Token.create({
        data: token,
        userId: userId
      });
    }
  });
}

function deleteToken(tokenId) {
  return Token.destroy({
    where: {
      id: tokenId
    }
  });
}

function getTokens() {
  return Token.findAll({
    include: [{
      model: User
    }]
  });
}

// ===== Message ===== //
function createMessage(msg, userId) {
  return Message.create({
    data: msg,
    userId: userId
  });
}

function deleteMessage(msgId) {
  return Message.destroy({
    where: {
      id: msgId
    }
  });
}

function getMessages() {
  return Message.findAll({
    include: [{
      model: User
    }],
    limit: 30,
    order: [
      ['date', 'DESC']
    ]
  });
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
  getProject,
  getProjectList,
  updateProject,
  deleteProject,
  createMaintainer,
  isMaintainer,
  createTodo,
  deleteProjectTodo,
  createToken,
  deleteToken,
  getTokens,
  createMessage,
  deleteMessage,
  getMessages
};