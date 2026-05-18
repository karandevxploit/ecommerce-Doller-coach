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

const getDeviceTokens = (user = {}) => {
  const tokens = [];

  if (user.fcmToken) tokens.push(user.fcmToken);

  if (Array.isArray(user.devices)) {
    user.devices.forEach((device) => {
      if (device?.fcmToken) tokens.push(device.fcmToken);
    });
  }

  return [...new Set(tokens.filter(Boolean))];
};

const sendFcmToTokens = async ({ tokens = [], title, body, type }) => {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!uniqueTokens.length) return;

  try {
    if (!admin || !admin.messaging || !admin.apps || admin.apps.length === 0) return;

    if (uniqueTokens.length === 1) {
      await sendFcmToToken({ token: uniqueTokens[0], title, body, type });
      return;
    }

    await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens.slice(0, 500),
      notification: { title, body },
      data: { type: String(type || "system") },
    });
  } catch {
    // Ignore FCM delivery errors (token could be invalid).
  }
};

exports.createNotification = async ({
  userId = null,
  title,
  body,
  type = "system",
  audience = "private",
  priority = "normal",
  meta = {},
}) => {
  const created = await Notification.create({ userId, title, body, type, audience, priority, meta });

  if (userId && audience !== "admin") {
    const u = await User.findById(userId).select("fcmToken devices").lean();
    await sendFcmToTokens({ tokens: getDeviceTokens(u), title, body, type });
  }

  // Real-time synchronization for Admins removed (Step 5)

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
    const tokens = await User.find({
      isDeleted: { $ne: true },
      $or: [{ fcmToken: { $ne: null } }, { "devices.fcmToken": { $ne: null } }],
    }).select("fcmToken devices").lean();
    const tokenList = tokens.flatMap(getDeviceTokens);
    if (!tokenList.length) return;
    await sendFcmToTokens({ tokens: tokenList, title, body, type: "offer" });
  } catch {
    // ignore
  }
};

const { notificationQueue } = require("./queue.service");

exports.notifyAdminsImmediate = async ({ title, body, type = "system" }) => {
  const created = await Notification.create({
    userId: null,
    audience: "admin",
    title,
    body,
    type,
  });

  // Instant socket blast removed (Step 6)
};

exports.notifyAdmins = async ({ title, body, type = "system" }) => {
  await notificationQueue.add("admin-notify", { title, body, type });
};
