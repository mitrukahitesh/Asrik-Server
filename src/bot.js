const axios = require("axios");
const URL =
  "http://api.brainshop.ai/get?bid=161754&key=7uUZNcED6uX1A3o3&uid=xyz&msg=";

const getBotReply = function (req, res) {
  axios
    .get(`${URL}${req.params.message}`)
    .then((data) => {
      res.setHeader("Content-Type", "application/json");
      if (!data) throw Error("Failed");
      console.log(data);
      res.json({
        status: 200,
        message: "Success",
        reply: data.data.cnt,
      });
    })
    .catch((err) => {
      res.json({
        status: 400,
      });
      console.log(err);
    });
};

module.exports = getBotReply;
