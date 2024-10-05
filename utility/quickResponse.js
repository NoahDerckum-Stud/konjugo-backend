function badRequest(res, message = "Bad Request") {
  return res.status(400).send({ message });
}

function unauthorized(res) {
  return res.status(401).send({});
}

module.exports = { badRequest, unauthorized };
