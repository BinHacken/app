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

/*
sequelize.sync().then(() => {
  User.create({
    name: username,
    password: password
  });
});
*/

/*
var user = await User.create({
  name: username,
  password: password
});
return user;
*/

/*
const User = sequelize.define('user', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  }
}, {
  // options
});

sequelize.sync().then(() =>
  User.create({
    name: "Spacehuhn",
    password: "whatever"
  })).then(user => {
  console.log("User's auto-generated ID:", user.id);
});

var getUser = function(username) {
  return User.findAll({
    attributes: [
      'name',
      'password'
    ],
    where: {
      name: username
    },
    limit: 1
  });
};
/*
getUser("Spacehuhn").then(function(data) {
  console.log(data[0].dataValues);
});*/