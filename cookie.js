function get(req) {
  return {
    sid: req.signedCookies["session.sid"],
    token: req.signedCookies["session.token"],
    userId: req.signedCookies["session.userId"]
  };
}

function set(res, data) {
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

  if (data.userId) {
    res.cookie('session.userId', data.userId, {
      signed: true,
      maxAge: (30 * 24 * 60 * 60 * 1000)
    });
  }

  console.log('Set cookie ');
  console.log(data);
}

function clear(res) {
  res.cookie('session.sid', '', {
    maxAge: 0
  }).cookie('session.token', '', {
    maxAge: 0
  }).cookie('session.userId', '', {
    maxAge: 0
  });

  console.log("Deleted cookies");
}

module.exports = {
  get,
  set,
  clear
};