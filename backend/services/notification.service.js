const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const { admin } = require("./firebaseAdmin");

async function sendFcmToToken({ token, title, body, type }) {
  if (!token) return;
  try {
    if (!admin || !admin.messaging || !admin.apps || admin.apps.length === 0) return;
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { type: String(type || "system") },
    });
  } catch {
    // Ignore FCM delivery errors (token could be invalid).
  }
}

exports.createNotification = async ({
  userId = null,
  title,
  body,
  type = "system",
  audience = "private",
}) => {
  const created = await Notification.create({ userId, title, body, type, audience });

  if (userId && audience !== "admin") {
    const u = await User.findById(userId).select("fcmToken").lean();
    await sendFcmToToken({ token: u?.fcmToken, title, body, type });
  }

  return created;
};

exports.broadcastOffer = async ({ title, body }) => {
  await Notification.create({
    userId: null,
    audience: "all",
    title,
    body,
    type: "offer",
  });

  try {
    if (!admin || !admin.apps || admin.apps.length === 0) return;
    const tokens = await User.find({ fcmToken: { $ne: null } }).select("fcmToken").lean();
    const tokenList = tokens.map((t) => t.fcmToken).filter(Boolean);
    if (!tokenList.length) return;
    await admin.messaging().sendEachForMulticast({
      tokens: tokenList,
      notification: { title, body },
      data: { type: "offer" },
    });
  } catch {
    // ignore
  }
};

const { notificationQueue } = require("./queue.service");

exports.notifyAdminsImmediate = async ({ title, body, type = "system" }) => {
  await Notification.create({
    userId: null,
    audience: "admin",
    title,
    body,
    type,
  });
};

exports.notifyAdmins = async ({ title, body, type = "system" }) => {
  await notificationQueue.add("admin-notify", { title, body, type });
};
