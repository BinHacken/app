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
    type: DataTypes.STRING,
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
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  token: {
    type: DataTypes.STRING,
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
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  // Options
});

// ========== Functions ========== //
module.exports.init = function() {
  return sequelize.authenticate().then(() => {
    return sequelize.sync({
      alter: true
    });
  }).then(() => {
    // remove old sessions
    return sequelize.query("DELETE FROM `sessions` WHERE `date` <= date('now','-30 day')", {
      raw: true
    });
  }).then(() => {
    console.log('DB connected');
  }).catch(err => {
    console.error('Unable to connect: ', err);
  });
}

module.exports.auth = function(username, password) {
  return User.findAndCountAll({
    where: {
      name: username,
      password: hash.make(password)
    }
  }).then(result => {
    return (result.count > 0);
  });
};

module.exports.createSession = function(username) {
  var sid = crypto.randomBytes(16).toString('hex');
  var token = crypto.randomBytes(16).toString('hex');

  return Session.create({
    username: username,
    sid: sid,
    token: token
  });
};

module.exports.authSession = function(username, sid, token) {
  // find sessions
  return Session.findOne({
    where: {
      username: username,
      sid: sid,
      token: token
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

module.exports.deleteSession = function(username, sid) {
  return Session.destroy({
    where: {
      username: username,
      sid: sid
    }
  });
};

module.exports.updateSession = function(username, sid) {
  return Session.destroy({
    where: {
      username: username,
      sid: sid
    }
  });
};

module.exports.renameSession = function(old_username, new_username) {
  return Session.update({
    username: new_username
  }, {
    where: {
      username: old_username
    }
  });
}

module.exports.createUser = function(username, password) {
  return User.create({
    name: username,
    password: password
  });
};

module.exports.getUserList = function() {
  return User.findAll({
    attributes: ['name', 'html']
  });
}

module.exports.getUserData = function(username) {
  return User.findOne({
    where: {
      name: username
    }
  });
}

module.exports.updateUser = function(username, field, value) {
  return User.findOne({
    where: {
      name: username
    }
  }).then((user) => {
    user.set(field, value);
    return user.save();
  });
}

module.exports.deleteUser = function(username) {
  return User.findOne({
    where: {
      name: username
    }
  }).then((user) => {
    user.destroy();
    return user.save();
  });
}

module.exports.exists = function(username) {
  return User.count({
    where: {
      name: username
    }
  }).then(count => {
    return count > 0;
  });
}

module.exports.createLink = function(name, url, username) {
  return Link.create({
    name: name,
    url: url,
    username: username
  });
}

module.exports.getLinks = function() {
  return Link.findAll();
}

module.exports.deleteLink = function(name, url) {
  return Link.destroy({
    where: {
      name: name,
      url: url
    }
  });
}