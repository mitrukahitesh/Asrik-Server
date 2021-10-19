const admin = require("firebase-admin");

const serviceAccount = require(__dirname + "/google_services.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

const sendNotificationToAdmin = async function (req, res) {
  try {
    const pin = req.params.code;
    const body = req.body;
    let snapshot = await firestore.collection("ADMINS").doc(pin).get();
    const adminUid = snapshot.data().ADMIN;
    snapshot = await firestore.collection("TOKENS").doc(adminUid).get();
    const token = snapshot.data().TOKEN;
    sendMessageToAdmin(token, body)
      .then((response) => {
        console.log(response);
        return;
      })
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    throw err;
  }
};

const sendMessageToAdmin = async function (token, body) {
  console.log(body);
  try {
    const payload = {
      data: {
        forAdmin: "true",
        title: `Request by ${body.nameValuePairs.NAME}`,
        body: `${body.nameValuePairs.UNITS} units ${body.nameValuePairs.BLOOD_GROUP}`,
        profile_pic_url: `${body.UNITS} units ${body.nameValuePairs.PROFILE_PIC_URL}`,
      },
    };
    const options = {
      priority: "high",
      timeToLive: 60 * 60 * 24,
    };
    const response = await admin
      .messaging()
      .sendToDevice(token, payload, options);
    return response;
  } catch (err) {
    throw err;
  }
};

module.exports.sendNotificationToAdmin = sendNotificationToAdmin;
