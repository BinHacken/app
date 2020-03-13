const crypto = require('crypto');

module.exports.make = function(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
};

module.exports.compare = function(plaintext, hashed) {
  return this.make(plaintext) == hashed;
};