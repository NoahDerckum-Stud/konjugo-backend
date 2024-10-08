async function analyzse(text, langiso) {
  const data = {
    text,
    langiso,
  };

  let result = await fetch("http://localhost:5000/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  console.log(result);

  return result.json();
}

module.exports = { analyzse };
