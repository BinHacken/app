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
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  data: {
    type: Sequelize.TEXT
  }
}, {
  // options
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
    attributes: ['name', 'data']
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