require("dotenv").config();
const express = require("express");
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
      mongoUrl: "mongodb://localhost:27017/",
    }),
  })
);

app.use("/auth", authRoute);
app.use("/train", trainRoute);
app.use("/stats", statisticsRoute);
app.use("/stories", storiesRoute);
app.use("/profile", profileRoute);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
