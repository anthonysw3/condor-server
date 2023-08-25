var { Duffel } = require("@duffel/api");

const authToken = process.env.DUFFEL_ACCESS_TOKEN;

if (!authToken) {
  throw new Error(
    `Duffel access token not found in the environment variables.`
  );
}

const duffel = new Duffel({
  token: authToken,
});

module.exports = duffel;
