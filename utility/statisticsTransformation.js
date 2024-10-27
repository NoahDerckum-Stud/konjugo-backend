const { toNumber } = require("lodash");
const db = require("../utility/database");

function initTransform(stats, mode) {
  if (!["weekly", "daily"].includes(mode)) {
    mode = "weekly";
  }

  let result = {};
  for (let i = 0; i < stats.length; i++) {
    let date = new Date(stats[i].timestamp);
    let convertedDate = convertDate(date, mode);
    for (let tag of stats[i].tags) {
      if (!result[tag]) result[tag] = {};
      if (!result[tag][convertedDate])
        result[tag][convertedDate] = { levenshteins: [], seconds: [] };
      result[tag][convertedDate].levenshteins.push(stats[i].levenshtein);
      result[tag][convertedDate].seconds.push(stats[i].seconds);
    }
  }
  return result;
}

const colors = [
  "#FF5733", // Red
  "#33FF57", // Green
  "#3357FF", // Blue
  "#FFFF33", // Yellow
  "#FF33FF", // Magenta
  "#33FFFF", // Cyan
  "#FF8C00", // Orange
  "#8A2BE2", // Purple
  "#FFD700", // Gold
  "#FF1493", // Red 2
  "#00FF7F", // Green 2
  "#00BFFF", // Blue 2
  "#FF4500", // Red 3
  "#DA70D6", // Pink
  "#32CD32", // Green 3
  "#FF69B4", // Pink 2
  "#1E90FF", // Blue 3
  "#FFDAB9", // Orange 2
  "#6A5ACD", // Blue 4
  "#7FFF00", // Green 4
  "#FFB6C1", // Pink 3
];

async function transformStats(
  stats,
  langiso,
  displayLangiso,
  mode,
  ignoredGroupTypes = []
) {
  if (!["weekly", "daily"].includes(mode)) {
    mode = "weekly";
  }

  if (stats.length == 0) {
    return { labels: [], dataSets: { levenshtein: [], seconds: [] } };
  }

  let transformedStats = initTransform(stats, mode);

  let result = { levenshtein: {}, seconds: {} };

  let convertedDateMin = convertDate(new Date(stats[0].timestamp), mode);
  let convertedDateMax = convertDate(
    new Date(stats[stats.length - 1].timestamp),
    mode
  );

  let convertedDateCount = convertedDateMax - convertedDateMin + 1;
  let labels = new Array(convertedDateCount).fill(undefined);

  for (let i = 0; i < convertedDateCount; i++) {
    labels[i] = getOriginalDate(convertedDateMin + i, mode).toDateString();
  }

  for (let i in transformedStats) {
    result.levenshtein[i] = new Array(convertedDateCount).fill(undefined);
    result.seconds[i] = new Array(convertedDateCount).fill(undefined);

    for (let j in transformedStats[i]) {
      let levenshteinAvg = calculateAverage(
        transformedStats[i][j].levenshteins
      );
      let secondsAvg = calculateAverage(transformedStats[i][j].seconds);
      let jNum = toNumber(j);
      let index = jNum - convertedDateMin;
      result.levenshtein[i][index] = levenshteinAvg;
      result.seconds[i][index] = secondsAvg;
    }
  }

  let langinfo = await db.connection.db
    .collection("language")
    .findOne({ langiso });

  let projectedData = {
    levenshtein: projectData(
      result.levenshtein,
      langinfo,
      displayLangiso,
      ignoredGroupTypes
    ),
    seconds: projectData(
      result.seconds,
      langinfo,
      displayLangiso,
      ignoredGroupTypes
    ),
  };

  return { labels: labels, dataSets: projectedData };
}

function getRandomColor() {
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
}

function projectData(
  transformedStats,
  langinfo,
  displayLangiso,
  ignoredGroupTypes = []
) {
  let ignoredAttributes = [];

  for (let i = 0; i < langinfo.groups.length; i++) {
    let group = langinfo.groups[i];
    if (ignoredGroupTypes.includes(group.type)) {
      for (let j = 0; j < group.tags.length; j++) {
        let segment = group.tags[j];
        ignoredAttributes.push(segment.id);
      }
    }
  }
  let datasets = [];
  let colorIterator = 0;
  for (let i in transformedStats) {
    if (ignoredAttributes.includes(i.toString())) {
      continue;
    }

    colorIterator++;
    let attributeInfo = parseAttributeInfo(
      langinfo,
      displayLangiso,
      i.toString()
    );
    datasets.push({
      data: transformedStats[i],
      label: attributeInfo.title,
      backgroundColor: colors[colorIterator],
      borderColor: colors[colorIterator],
      attrtype: attributeInfo.type,
    });
  }
  return datasets;
}

function parseAttributeInfo(langinfo, displayLangiso, tag) {
  for (let i = 0; i < langinfo.groups.length; i++) {
    let group = langinfo.groups[i];
    for (let j = 0; j < group.tags.length; j++) {
      let segment = group.tags[j];
      if (tag == segment.id)
        return { title: segment.title[displayLangiso], type: group.type };
    }
  }
  return { title: tag, type: "unknown" };
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;

  const sum = numbers.reduce(
    (accumulator, current) => accumulator + current,
    0
  );
  return sum / numbers.length;
}

function convertDate(date, mode) {
  if (mode == "weekly") return getAbsoluteWeek(date);
  if (mode == "daily") return getAbsoluteDay(date);
  return undefined;
}

function getOriginalDate(date, mode) {
  if (mode == "weekly") return getDateFromAbsoluteWeek(date);
  if (mode == "daily") return getDateFromAbsoluteDay(date);
  return undefined;
}

function getAbsoluteDay(date) {
  const oneDay = 1000 * 60 * 60 * 24;
  const epoch = new Date(0);
  const diffInMillis = date - epoch;
  return Math.floor(diffInMillis / oneDay);
}

function getDateFromAbsoluteDay(dayCount) {
  const oneDay = 1000 * 60 * 60 * 24;
  const epoch = new Date(0);
  return new Date(epoch.getTime() + dayCount * oneDay);
}

function getAbsoluteWeek(date) {
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const unixBegin = new Date(1970, 0, 1);
  const diffInMillis = date - unixBegin;
  return Math.floor(diffInMillis / oneWeek);
}

function getDateFromAbsoluteWeek(weekNumber) {
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const unixBegin = new Date(1970, 0, 1);
  const targetDate = new Date(unixBegin.getTime() + weekNumber * oneWeek);
  const dayOfWeek = (targetDate.getDay() + 6) % 7;
  targetDate.setDate(targetDate.getDate() - dayOfWeek);
  return targetDate;
}

module.exports = { initTransform, transformStats };
