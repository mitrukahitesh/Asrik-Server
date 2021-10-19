const axios = require("axios");
const URL = "https://api.postalpincode.in/pincode/";

const getPincode = function (req, res) {
  axios
    .get(`${URL}${req.params.code}`)
    .then((data) => {
      res.setHeader("Content-Type", "application/json");
      res.json({
        status: 200,
        message: "Success",
        city: data.data[0].PostOffice[0].Block,
        state: data.data[0].PostOffice[0].State,
      });
    })
    .catch((err) => {
      res.json({
        status: 400,
      });
      console.log(err);
    });
};

module.exports = getPincode;
