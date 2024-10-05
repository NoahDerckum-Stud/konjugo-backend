const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost:27017/", {
    dbName: "konjugo",
    tls: false,
    ssl: false,
  })
  .then((c) => {})
  .catch((err) => {
    console.log(err);
  });

module.exports = mongoose;
