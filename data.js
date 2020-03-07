const md = require('markdown-it')().disable(['html_inline', 'image']);

const {
  Sequelize,
  Model,
  DataTypes
} = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './bindata.db'
});

const User = sequelize.define('user', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  data: {
    type: DataTypes.TEXT
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

module.exports.init = function() {
  return sequelize.authenticate().then(() => {
    sequelize.sync({
      alter: true
    }).then(() => {
      console.log('DB connected');
    });
  }).catch(err => {
    console.error('Unable to connect: ', err);
  });
};

module.exports.auth = function(username, password) {
  return User.findAndCountAll({
    where: {
      name: username,
      password: password
    }
  }).then(result => {
    return (result.count > 0);
  });
};

module.exports.createUser = function(username, password) {
  return sequelize.sync().then(() => {
    return User.create({
      name: username,
      password: password
    });
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