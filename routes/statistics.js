const router = require("express").Router();
const db = require("../utility/database.js");
const { authMiddleware } = require("./auth.js");
const mongoose = require("mongoose");
const { transformStats } = require("../utility/statisticsTransformation.js");
const qr = require("../utility/quickResponse");

router.post("/statistics", authMiddleware, async (req, res) => {
  let statistics = req.body.statistics;

  if (!Array.isArray(statistics)) {
    return qr.badRequest(res, "Missing / Bad Parameters");
  }

  let invalidInput = false;

  for (let i = 0; i < statistics.length; i++) {
    if (
      !statistics[i].langiso ||
      !statistics[i].lemma ||
      !Array.isArray(statistics[i].tags) ||
      !statistics[i].langiso ||
      !statistics[i].timestamp ||
      !statistics[i].seconds ||
      !statistics[i].levenshtein
    ) {
      invalidInput = true;
      break;
    }
    statistics[i].userId = new mongoose.Types.ObjectId(req.session.user.id);
    statistics[i].timestamp = new Date(statistics[i].timestamp);
  }

  if (invalidInput) {
    return qr.badRequest(res, "Bad statistics format");
  }

  await db.connection.collection("statistics").insertMany(statistics);
  res.send({});
});

router.post("/get_statistics", authMiddleware, async (req, res) => {
  let page = req.body.page;
  let dateRange = req.body.dateRange;
  let attributes = req.body.attributes;
  let grouping = req.body.grouping;
  let langiso = req.body.langiso;
  let displayLangiso = req.body.displayLangiso;
  let ignoredGroupTypes = req.body.ignoredGroupTypes;

  if (!langiso || !displayLangiso || !Array.isArray(attributes)) {
    return qr.badRequest(res, "Missing / Bad Parameters");
  }

  if (!ignoredGroupTypes) ignoredGroupTypes = [];
  if (!grouping) grouping = "weekly";
  if (!page) page = 0;

  let maxDate = new Date(8640000000000000);
  let minDate = new Date(-8640000000000000);
  if (!dateRange) dateRange = [minDate, maxDate];

  console.log(req.session.user);

  let result = await db.connection.db
    .collection("statistics")
    .aggregate([
      {
        $match: {
          langiso: langiso,
          userId: new mongoose.Types.ObjectId(req.session.user.id),
          timestamp: {
            $gte: new Date(dateRange[0]), // Startdatum
            $lte: new Date(dateRange[1]), // Enddatum
          },
        },
      },
      {
        $addFields: {
          isSubset: { $setIsSubset: ["$tags", attributes] },
        },
      },
      {
        $match: {
          isSubset: true,
        },
      },
      {
        $project: {
          isSubset: 0,
          userId: 0,
        },
      },
    ])
    .toArray();

  return res.send({
    list: result.slice(20 * page, 20 * page + 20),
    graphData: await transformStats(
      result,
      langiso,
      displayLangiso,
      grouping,
      ignoredGroupTypes
    ),
  });
});

module.exports = router;
