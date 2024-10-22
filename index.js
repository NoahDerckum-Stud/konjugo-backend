require("dotenv").config();
const express = require("express");
require("express-async-errors");
const app = express();
const port = 3000;
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { authRoute } = require("./routes/auth");
const trainRoute = require("./routes/train");
const statisticsRoute = require("./routes/statistics.js");
const storiesRoute = require("./routes/stories.js");
const profileRoute = require("./routes/profile");

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,

    store: MongoStore.create({
      dbName: "konjugo",
      mongoUrl: process.env.MONGODB_URI,
    }),
  })
);

app.use("/auth", authRoute);
app.use("/train", trainRoute);
app.use("/stats", statisticsRoute);
app.use("/stories", storiesRoute);
app.use("/profile", profileRoute);

app.use((err, req, res, next) => {
  if (err) {
    console.log(err);
    return res.status(500).send({});
  }
  next(err);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
