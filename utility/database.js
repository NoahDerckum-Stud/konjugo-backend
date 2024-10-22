const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "konjugo",
    tls: false,
    ssl: false,
  })
  .then((c) => {})
  .catch((err) => {
    console.log(err);
  });

module.exports = mongoose;
