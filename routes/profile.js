const router = require("express").Router();
const db = require("../utility/database.js");
const qr = require("../utility/quickResponse");
const { badRequest } = require("../utility/quickResponse.js");
const { authMiddleware } = require("./auth.js");
const mongoose = require("mongoose");
const { mailRegularExpression } = require("../utility/regularExpressions");
const bcrypt = require("bcrypt");
const saltRounds = 10;

router.get("/profile_info", authMiddleware, async (req, res) => {
  let user = await db.connection
    .collection("user")
    .findOne({ _id: new mongoose.Types.ObjectId(req.session.user.id) });

  res.send({ username: user.username, mail: user.mail });
});

router.delete("/user", authMiddleware, async (req, res) => {
  let user = await db.connection
    .collection("user")
    .deleteOne({ _id: new mongoose.Types.ObjectId(req.session.user.id) });

  await db.connection
    .collection("statistics")
    .deleteMany({ userId: new mongoose.Types.ObjectId(req.session.user.id) });

  req.session.user = undefined;
  req.session.destroy();
  res.send({});
});

router.put("/mail", authMiddleware, async (req, res) => {
  let mail = req.body.mail;
  if (!mail) {
    return badRequest(res, "Missing Parameter");
  }

  if (!mail.match(mailRegularExpression)) {
    return qr.badRequest(res, "Incorrect Mail format");
  }

  await db.connection
    .collection("user")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(req.session.user.id) },
      { $set: { mail: mail } }
    );

  res.send({});
});

router.put("/username", authMiddleware, async (req, res) => {
  let username = req.body.username;
  if (!username) {
    return badRequest(res, "Missing Parameter");
  }

  if (username.length < 6) {
    return qr.badRequest(res, "Invalid username length");
  }

  let users = await db.connection
    .collection("user")
    .find({ username: username })
    .toArray();

  if (users.length > 0) {
    return qr.badRequest(res, "Username already exists");
  }

  await db.connection
    .collection("user")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(req.session.user.id) },
      { $set: { username: username } }
    );

  res.send({});
});

router.put("/password", authMiddleware, async (req, res) => {
  let password = req.body.password;
  if (!password) {
    return badRequest(res, "Missing Parameter");
  }

  if (password.length < 6) {
    return qr.badRequest(res, "Invalid password length");
  }

  await db.connection
    .collection("user")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(req.session.user.id) },
      { $set: { passwordHash: await bcrypt.hash(password, saltRounds) } }
    );

  res.send({});
});

module.exports = router;
