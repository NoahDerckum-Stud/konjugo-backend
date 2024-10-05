const router = require("express").Router();
const qr = require("../utility/quickResponse");
const db = require("../utility/database");
const { authMiddleware } = require("../routes/auth.js");
const mongoose = require("mongoose");

router.get("/languages", async (req, res) => {
  let result = await db.connection.db
    .collection("language")
    .find({})
    .project({ langiso: 1, title: 1, imgref: 1, _id: 0 })
    .toArray();

  return res.send(result);
});

router.post("/start_challange", authMiddleware, async (req, res) => {
  let lemmas = req.body.lemmas;
  let tags = req.body.tags;
  let langiso = req.body.langiso;
  let samples = req.body.samples;

  if (!langiso || !tags || !lemmas || !samples) {
    return qr.badRequest(res, "Missing Parameters");
  }

  let langInfo = await db.connection.db
    .collection("language")
    .findOne({ langiso });

  if (!langInfo?.groups) {
    return qr.badRequest(res, "Invalid language iso");
  }

  const trainingSetAggregation = [
    {
      $match: {
        langIso: langiso,
      },
    },
    {
      $match: {
        lemma: {
          $in: lemmas,
        },
      },
    },
    {
      $match: {
        $expr: {
          $setIsSubset: ["$tags", tags],
        },
      },
    },
    {
      $sample: { size: samples + 1 },
    },
  ];

  let challangesResult = await db.connection
    .collection("flection")
    .aggregate(trainingSetAggregation)
    .project({ lemma: 1, flection: 1, tags: 1, type: 1, _id: 0 })
    .toArray();

  res.send(challangesResult);
});

router.post("/lemma_preview", async (req, res) => {
  let lemma = req.body.lemma;
  let langiso = req.body.langiso;

  if (!lemma || !langiso) {
    return qr.badRequest(res, "Missing parameters");
  }

  let result = await db.connection
    .collection("flection")
    .aggregate([
      {
        $match: {
          langIso: langiso,
          lemma: new RegExp(`^${lemma}`),
        },
      },
      {
        $group: {
          _id: "$lemma",
          type: { $first: "$type" },
        },
      },
      {
        $project: {
          _id: 0,
          lemma: "$_id",
          type: 1,
        },
      },
      {
        $limit: 10,
      },
    ])
    .toArray();

  return res.send(result);
});

router.post("/langdetails", async (req, res) => {
  let langiso = req.body.langiso;

  if (!langiso) {
    return qr.badRequest(res, "Missing parameters");
  }

  let result = await db.connection.db
    .collection("language")
    .findOne({ langiso });

  if (!result) {
    return qr.badRequest(res, "Invalid langiso");
  }

  return res.send(result);
});

router.post("/get_lemma_collections", async (req, res) => {
  let langiso = req.body.langiso;

  if (!langiso) {
    return qr.badRequest(res);
  }

  let result = await db.connection.db
    .collection("lemma_collection")
    .find({ langiso })
    .toArray();

  return res.send(result);
});

module.exports = router;
