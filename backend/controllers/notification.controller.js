const asyncHandler = require("express-async-handler");
const { ok } = require("../utils/apiResponse");
const Notification = require("../models/notification.model");
const { createNotification } = require("../services/notification.service");

exports.sendNotification = asyncHandler(async (req, res) => {
  const { userId, title, body, type } = req.body;
  await createNotification({ userId, title, body, type, audience: "private" });
  return ok(res, { sent: true }, "");
});

exports.myNotifications = asyncHandler(async (req, res) => {
  const data = await Notification.find({
    $and: [
      {
        $or: [{ userId: req.user._id }, { audience: "all" }],
      },
      { audience: { $ne: "admin" } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return ok(res, data, "");
});

exports.adminFeed = asyncHandler(async (_req, res) => {
  const data = await Notification.find({ audience: "admin" })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return ok(res, data, "");
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Notification.updateOne({ _id: id, userId: req.user._id }, { $set: { readAt: new Date() } });
  return ok(res, { ok: true }, "");
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return ok(res, { ok: true }, "");
});
