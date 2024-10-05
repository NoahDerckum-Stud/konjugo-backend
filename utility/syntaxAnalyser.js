async function analyzse(text) {
  const data = {
    text,
  };

  let result = await fetch("http://localhost:5000/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return result.json();
}

module.exports = { analyzse };
