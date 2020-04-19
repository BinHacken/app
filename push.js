var admin = require("firebase-admin");
var serviceAccount = require("./private/firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://binhackenapp.firebaseio.com"
});

function send(msg, token) {
  return admin.messaging().send({
    notification: {
      title: msg.substring(0, 25),
      body: msg
    },
    data: {},
    token: token
  });
}

module.exports = {
  send
}