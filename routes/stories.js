const router = require("express").Router();
const qr = require("../utility/quickResponse.js");
const db = require("../utility/database.js");
const { authMiddleware } = require("./auth.js");
const mongoose = require("mongoose");
const { analyzse } = require("../utility/syntaxAnalyser");

router.post("/story", authMiddleware, async (req, res) => {
  let title = req.body.title;
  let description = req.body.description;
  let langiso = req.body.langiso;
  let story = req.body.story;
  let types = req.body.types;

  if (!types) {
    types = ["ADJ", "V", "N"];
  }

  if (
    !langiso ||
    title?.length < 6 ||
    description?.length < 6 ||
    story?.length < 10 ||
    !Array.isArray(types)
  )
    return qr.badRequest(res, "Invalid Parameters");

  let constructedText = [];
  let placeholders = [];

  let storySyntax = await analyzse(story);

  let iterater = 0;
  for (let element of storySyntax) {
    let elementType = undefined;

    if (element.tag == "VERB" || element.tag == "AUX") {
      elementType = "V";
    }

    if (element.tag == "ADJ") {
      elementType = "ADJ";
    }

    if (element.tag == "NOUN") {
      elementType = "N";
    }

    if (elementType && types.includes(elementType)) {
      let result = await db.connection.db.collection("flection").findOne({
        langIso: langiso,
        flection: element.text,
        type: elementType,
      });
      if (result) {
        constructedText.push(iterater);
        placeholders.push({
          lemma: result.lemma,
          flection: result.flection,
          tags: result.tags,
          type: result.type,
        });
        iterater++;
      } else {
        constructedText.push(element.text);
      }
    } else {
      constructedText.push(element.text);
    }
  }

  await await db.connection.db.collection("story").insertOne({
    langiso: langiso,
    user: new mongoose.Types.ObjectId(req.session.user.id),
    text: constructedText,
    placeholders: placeholders,
    title: title,
    description: description,
    timestamp: new Date(),
    likes: [],
  });

  return res.send({});
});

router.post("/get_story", authMiddleware, async (req, res) => {
  let id = req.body.id;

  let story = await db.connection.db
    .collection("story")
    .find({ _id: new mongoose.Types.ObjectId(id) })
    .project({ likes: 0 })
    .toArray();

  if (story.length == 0) {
    return qr.badRequest(res, "Invalid story id");
  }

  res.send(story[0]);
});

router.post("/set_story_like", authMiddleware, async (req, res) => {
  let id = req.body.id;
  let state = req.body.state;

  if (!id || !state) {
    return qr.badRequest(res, "Missing Parameters");
  }

  if (state) {
    await db.connection.db.collection("story").updateOne(
      {
        _id: new mongoose.Types.ObjectId(id),
      },
      { $addToSet: { likes: new mongoose.Types.ObjectId(req.session.user.id) } }
    );
  } else {
    await db.connection.db.collection("story").updateOne(
      {
        _id: new mongoose.Types.ObjectId(id),
      },
      { $pull: { likes: new mongoose.Types.ObjectId(req.session.user.id) } }
    );
  }

  res.send({});
});

router.post("/get_story_dash", authMiddleware, async (req, res) => {
  let langiso = req.body.langiso;

  if (!langiso) {
    return qr.badRequest(res, "Missing Parameters");
  }

  let userStories = await db.connection.db
    .collection("story")
    .aggregate([
      {
        $match: {
          langiso: langiso,
          user: new mongoose.Types.ObjectId(req.session.user.id),
        },
      },
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          placeholderCount: { $size: "$placeholders" },
          liked: {
            $in: [new mongoose.Types.ObjectId(req.session.user.id), "$likes"],
          },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 10,
      },
    ])
    .project({
      user: 0,
      likes: 0,
    })
    .toArray();

  let recentStories = await db.connection.db
    .collection("story")
    .aggregate([
      {
        $match: {
          langiso: langiso,
        },
      },
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          placeholderCount: { $size: "$placeholders" },
          liked: {
            $in: [new mongoose.Types.ObjectId(req.session.user.id), "$likes"],
          },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 10,
      },
    ])
    .project({
      user: 0,
      likes: 0,
    })
    .toArray();

  let popularStories = await db.connection.db
    .collection("story")
    .aggregate([
      {
        $match: {
          langiso: langiso,
        },
      },
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          placeholderCount: { $size: "$placeholders" },
          liked: {
            $in: [new mongoose.Types.ObjectId(req.session.user.id), "$likes"],
          },
        },
      },
      {
        $sort: { likeCount: -1 },
      },
      {
        $limit: 10,
      },
    ])
    .project({
      user: 0,
      likes: 0,
    })
    .toArray();

  res.send({ userStories, recentStories, popularStories });
});

module.exports = router;
