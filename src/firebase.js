const admin = require("firebase-admin");
const schedule = require("node-schedule");
const nodemailer = require("nodemailer");

const serviceAccount = require(__dirname + "/google_services.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const THREE_DAY_MILLIS = 3 * 24 * 60 * 60 * 1000;

const options = {
  priority: "high",
  timeToLive: 60 * 60 * 24,
};

const firestore = admin.firestore();

// Notify ADMIN for new request
const sendNotificationToAdmin = async function (req, res) {
  try {
    const pin = req.params.code;
    const body = req.body;
    let snapshot = await firestore.collection("ADMINS").doc(pin).get();
    let adminUid;
    if (snapshot.exists) adminUid = snapshot.data().ADMIN;
    else {
      snapshot = await firestore.collection("ADMINS").doc("400001").get();
      adminUid = snapshot.data().ADMIN;
    }
    snapshot = await firestore.collection("TOKENS").doc(adminUid).get();
    const token = snapshot.data().TOKEN;
    await sendMessageToAdmin(token, body);
  } catch (err) {
    throw err;
  }
};

const sendMessageToAdmin = async function (token, body) {
  try {
    const payload = {
      data: {
        forAdmin: "true",
        title: `Request by ${body.nameValuePairs.NAME}`,
        body: `${body.nameValuePairs.UNITS} units of ${body.nameValuePairs.BLOOD_GROUP} [${body.nameValuePairs.SEVERITY}]`,
        profile_pic_url: `${body.nameValuePairs.PROFILE_PIC_URL}`,
      },
    };
    const response = await admin
      .messaging()
      .sendToDevice(token, payload, options);
    return response;
  } catch (err) {
    throw err;
  }
};

// Notify all users in particular area including seeker for request verification
const sendNotificationToUsersForRequestVerified = async function (req, res) {
  try {
    const pin = req.params.code;
    const seeker = req.params.seeker;
    const tokens = [];
    const snapshot = await firestore
      .collection("USERS")
      .where("PIN_CODE", "==", pin)
      .get();
    const seekerToken = await firestore.collection("TOKENS").doc(seeker).get();
    for (const doc of snapshot.docs) {
      if (doc.id !== seeker) {
        let userSnapshot = await firestore
          .collection("TOKENS")
          .doc(doc.id)
          .get();
        tokens.push(userSnapshot.data().TOKEN);
      }
    }
    await sendMessageToUsersForRequestVerified(
      tokens,
      seekerToken.data().TOKEN,
      req.body
    );
    const seekerInfo = await firestore.collection("USERS").doc(seeker).get();
    const email = seekerInfo.data().EMAIL;
    sendEmail(
      email,
      "Request Approved",
      `Dear user,\n\nWe are happy to inform that your request for ${req.body.nameValuePairs.UNITS} units of ${req.body.nameValuePairs.BLOOD_GROUP} has been verified by ${req.body.nameValuePairs.ADMIN}.\n\nWishing a speedy recovery.\n\nRegards,\nAsrik`
    );
    scheduleCooldown(req.body);
  } catch (err) {
    throw err;
  }
};

const sendMessageToUsersForRequestVerified = async function (
  tokens,
  seeker,
  body
) {
  try {
    const payloadForNonSeeker = {
      data: {
        forAdmin: "false",
        title: `Request by ${body.nameValuePairs.NAME}`,
        body: `${body.nameValuePairs.UNITS} units of ${body.nameValuePairs.BLOOD_GROUP} [${body.nameValuePairs.SEVERITY}]`,
        profile_pic_url: `${body.nameValuePairs.PROFILE_PIC_URL}`,
      },
    };
    const payloadForSeeker = {
      data: {
        forAdmin: "false",
        title: `Request Verified by ${body.nameValuePairs.ADMIN}`,
        body: `${body.nameValuePairs.UNITS} units of ${body.nameValuePairs.BLOOD_GROUP} [${body.nameValuePairs.SEVERITY}]`,
        profile_pic_url: `${body.nameValuePairs.PROFILE_PIC_URL}`,
      },
    };
    let responseNonSeeker;
    if (tokens.length > 0) {
      responseNonSeeker = await admin
        .messaging()
        .sendToDevice(tokens, payloadForNonSeeker, options);
    }
    let responseSeeker = await admin
      .messaging()
      .sendToDevice(seeker, payloadForSeeker, options);
    return {
      responseNonSeeker: responseNonSeeker,
      responseSeeker: responseSeeker,
    };
  } catch (err) {
    throw err;
  }
};

const scheduleCooldown = function (body) {
  const emergency = body.nameValuePairs.EMERGENCY;
  const id = body.nameValuePairs.REQUEST_ID;
  if (!emergency) return;
  else {
    const scheduleDate = new Date(new Date().getTime() + THREE_DAY_MILLIS);
    schedule.scheduleJob(scheduleDate, () => {
      firestore.collection("REQUESTS").doc(id).update({
        emergency: false,
      });
    });
  }
};

// Notify user for request rejection
const sendNotificationForRequestRejection = async function (req, res) {
  try {
    const uid = req.params.seeker;
    let snapshot = await firestore.collection("TOKENS").doc(uid).get();
    const token = snapshot.data().TOKEN;
    await sendRejectionMessage(token, req.body);
    const seekerInfo = await firestore.collection("USERS").doc(uid).get();
    const email = seekerInfo.data().EMAIL;
    sendEmail(
      email,
      "Request Rejected",
      `Dear user,\n\nWe are sorry to inform that your request for ${req.body.nameValuePairs.UNITS} units of ${req.body.nameValuePairs.BLOOD_GROUP} has been rejected by ${req.body.nameValuePairs.ADMIN}.\n\nWishing a speedy recovery.\n\nRegards,\nAsrik`
    );
  } catch (err) {
    throw err;
  }
};

const sendRejectionMessage = async function (token, body) {
  try {
    const payload = {
      data: {
        forAdmin: "false",
        title: `Request Rejected by ${body.nameValuePairs.ADMIN}`,
        body: `${body.nameValuePairs.UNITS} units of ${body.nameValuePairs.BLOOD_GROUP} [${body.nameValuePairs.SEVERITY}]`,
        profile_pic_url: `${body.nameValuePairs.PROFILE_PIC_URL}`,
      },
    };
    const response = await admin
      .messaging()
      .sendToDevice(token, payload, options);
    return response;
  } catch (err) {
    throw err;
  }
};

// Notify blood camps
const sendBloodCampNotification = async function (req, res) {
  try {
    const pin = req.params.code;
    const admin = req.params.id;
    const tokens = [];
    const snapshot = await firestore
      .collection("USERS")
      .where("PIN_CODE", "==", pin)
      .get();
    for (const doc of snapshot.docs) {
      if (doc.id !== admin) {
        let userSnapshot = await firestore
          .collection("TOKENS")
          .doc(doc.id)
          .get();
        tokens.push(userSnapshot.data().TOKEN);
      }
    }
    await sendBloodCampMessage(tokens, req.body);
  } catch (err) {
    throw err;
  }
};

const sendBloodCampMessage = async function (tokens, body) {
  try {
    const payload = {
      data: {
        bloodCamp: "true",
        title: `Blood Donation Camp`,
        date: body.nameValuePairs.DATE,
        body: `${body.nameValuePairs.ADDRESS}\n${body.nameValuePairs.DATE}\n${body.nameValuePairs.START_TIME} - ${body.nameValuePairs.END_TIME}`,
      },
    };
    if (tokens.length == 0) return;
    const response = await admin
      .messaging()
      .sendToDevice(tokens, payload, options);
    return response;
  } catch (err) {
    throw err;
  }
};

// Notify user for new message
const sendNewMessageNotification = async function (req, res) {
  try {
    const uid = req.params.receiver;
    let snapshot = await firestore.collection("TOKENS").doc(uid).get();
    const token = snapshot.data().TOKEN;
    console.log(req.body);
    await sendNewMessageMessage(token, req.body);
  } catch (err) {
    throw err;
  }
};

const sendNewMessageMessage = async function (token, body) {
  try {
    const payload = {
      data: {
        newMessage: "true",
        title: body.nameValuePairs.NAME,
        body: body.nameValuePairs.MESSAGE,
        number: body.nameValuePairs.NUMBER,
        chat_id: body.nameValuePairs.CHAT_ID,
      },
    };
    const response = await admin
      .messaging()
      .sendToDevice(token, payload, options);
    return response;
  } catch (err) {
    throw err;
  }
};

const sendEmail = function (email, subject, message) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 465,
    host: "smtp.gmail.com",
    auth: {
      user: "asrikcontact@gmail.com",
      pass: process.env.PASSWORD,
    },
  });

  const mailOptions = {
    from: "asrikcontact@gmail.com",
    to: email,
    subject: subject,
    text: message,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

module.exports.sendNotificationToAdmin = sendNotificationToAdmin;
module.exports.sendNotificationToUsersForRequestVerified =
  sendNotificationToUsersForRequestVerified;
module.exports.sendNotificationForRequestRejection =
  sendNotificationForRequestRejection;
module.exports.sendBloodCampNotification = sendBloodCampNotification;
module.exports.sendNewMessageNotification = sendNewMessageNotification;
