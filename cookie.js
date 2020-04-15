function get(req) {
  return {
    username: req.signedCookies["session.username"],
    sid: req.signedCookies["session.sid"],
    token: req.signedCookies["session.token"]
  };
}

function set(res, data) {
  if (data.username) {
    res.cookie('session.username', data.username, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  if (data.sid) {
    res.cookie('session.sid', data.sid, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  if (data.token) {
    res.cookie('session.token', data.token, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  console.log('Set cookie ');
  console.log(data);
}

function clear(res) {
  res.cookie('session.username', '', {
    maxAge: 0
  }).cookie('session.sid', '', {
    maxAge: 0
  }).cookie('session.token', '', {
    maxAge: 0
  });

  console.log("Deleted cookies");
}

module.exports = {
  get,
  set,
  clear
};