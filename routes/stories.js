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

  let storySyntax = await analyzse(story, langiso);

  let iterater = 0;
  for (let element of storySyntax) {
    let elementType = undefined;

    if (element.type == "VERB" || element.type == "AUX") {
      elementType = "V";
    }

    if (element.type == "ADJ") {
      elementType = "ADJ";
    }

    if (element.type == "NOUN") {
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

  if (placeholders.length > 0) {
    await db.connection.db.collection("story").insertOne({
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
  } else {
    return qr.badRequest(res, "The story does not return any challanges.");
  }
});

router.post("/get_story", authMiddleware, async (req, res) => {
  let id = req.body.id;

  let story = await db.connection.db
    .collection("story")
    .find({ _id: new mongoose.Types.ObjectId(id) })
    .project({ likes: 0 })
    .toArray();

  if (story.length == 0) return qr.badRequest(res, "Invalid story id");

  let user = await db.connection
    .collection("user")
    .findOne({ _id: new mongoose.Types.ObjectId(story[0].user) });

  story[0].username = user ? user.username : "Deleted User";

  res.send(story[0]);
});

router.post("/set_story_like", authMiddleware, async (req, res) => {
  let id = req.body.id;
  let state = req.body.state;

  if (!id || state == undefined) {
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

router.delete("/story", authMiddleware, async (req, res) => {
  let id = req.body.id;

  if (!id) {
    return qr.badRequest(res, "Missing Parameters");
  }

  await db.connection.db.collection("story").deleteOne({
    _id: new mongoose.Types.ObjectId(id),
  });

  res.send({});
});

router.post("/get_story_dash", authMiddleware, async (req, res) => {
  let langiso = req.body.langiso;
  let area = req.body.area;
  let page = req.body.page;

  if (!page) page = 0;
  if (!isFinite(page)) page = 0;

  if (!langiso) {
    return qr.badRequest(res, "Missing Parameters");
  }

  let filter = {
    langiso: langiso,
  };

  let sort = { timestamp: -1 };
  if (area == "popular") sort = { likeCount: -1 };

  if (area == "user") {
    filter.user = new mongoose.Types.ObjectId(req.session.user.id);
  }

  let stories = await db.connection.db
    .collection("story")
    .aggregate([
      {
        $match: filter,
      },
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          placeholderCount: { $size: "$placeholders" },
          liked: {
            $in: [new mongoose.Types.ObjectId(req.session.user.id), "$likes"],
          },
          deletable: area == "user",
        },
      },
      {
        $sort: sort,
      },
      {
        $limit: 500,
      },
    ])
    .project({
      user: 0,
      likes: 0,
    })
    .toArray();

  let pages = Math.floor((stories.length - 1) / 10);

  if (page > pages) page = pages;

  res.send({ page, pages, stories: stories.slice(page * 10, page * 10 + 10) });
});

module.exports = router;
