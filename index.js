const express = require("express");
const getPincode = require("./src/pincode");
const { sendNotificationToAdmin } = require("./src/firebase");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Set endpoints
app.get("/pincode/:code", (req, res) => {
  getPincode(req, res);
});

app.post("/new_request/:code", async (req, res) => {
  try {
    await sendNotificationToAdmin(req, res);
    res.status(200);
    res.send("Success");
  } catch (err) {
    res.status(500);
    res.send("Error");
    console.log(err.message);
  }
});

// Listen on port
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}..`);
});
