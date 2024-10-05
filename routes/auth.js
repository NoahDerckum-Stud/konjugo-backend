const authRoute = require("express").Router();
const qr = require("../utility/quickResponse");
const db = require("../utility/database");
const { mailRegularExpression } = require("../utility/regularExpressions");
const bcrypt = require("bcrypt");
const saltRounds = 10;

authRoute.post("/register", async (req, res) => {
  let username = req.body.username;
  let mail = req.body.mail;
  let password = req.body.password;

  if (!username || !password || !mail) {
    console.log(username, password, mail);
    return qr.badRequest(res);
  }

  if (username.length < 6) {
    return qr.badRequest(res, "Invalid username length");
  }

  if (password.length < 6) {
    return qr.badRequest(res, "Invalid password length");
  }

  if (!mail.match(mailRegularExpression)) {
    return qr.badRequest(res, "Incorrect Mail format");
  }

  let users = await db.connection
    .collection("user")
    .find({ $or: [{ mail: mail }, { username: username }] })
    .toArray();

  if (users.length > 0) {
    return qr.badRequest(res, "Username already exists");
  }

  await db.connection.collection("user").insertOne({
    username,
    mail,
    passwordHash: await bcrypt.hash(password, saltRounds),
  });

  res.redirect(307, "/api/auth/login");
});

authRoute.post("/login", async (req, res) => {
  let mail = req.body.mail;
  let password = req.body.password;

  if (!password || !mail) {
    return qr.badRequest(res, "Missing mail / password");
  }

  let user = await db.connection.collection("user").findOne({ mail: mail });

  if (!user) {
    return qr.badRequest(res, "User not found");
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return qr.badRequest(res, "Invalid Password");
  }

  req.session.user = {
    id: user._id,
    username: user.username,
    mail: user.mail,
  };

  return res.send({});
});

authRoute.get("/logged_in", authMiddleware, async (req, res) => {
  return res.send({});
});

authRoute.post("/logout", authMiddleware, async (req, res) => {
  req.session.user = undefined;
  req.session.destroy();
  return res.send({});
});

authRoute.post("/user_exists", async (req, res) => {
  let mail = req.body.mail;

  if (!mail) {
    return qr.badRequest(res, "Missing mail");
  }

  let users = await db.connection
    .collection("user")
    .find({ $or: [{ mail: mail }] })
    .toArray();

  return res.send({ exists: users.length != 0 });
});

function authMiddleware(req, res, next) {
  if (req.session?.user) {
    next();
    return;
  }
  return qr.unauthorized(res);
}

module.exports = { authRoute, authMiddleware };
