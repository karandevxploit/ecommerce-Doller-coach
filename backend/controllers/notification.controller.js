const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const { ok, fail } = require("../utils/apiResponse");
const Notification = require("../models/notification.model");
const { createNotification } = require("../services/notification.service");
const { logger } = require("../utils/logger");

// ===============================
// VALIDATION HELPERS
// ===============================
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ===============================
// SEND NOTIFICATION (ADMIN ONLY)
// ===============================
exports.sendNotification = asyncHandler(async (req, res) => {
  const { userId, title, body, type, audience } = req.body;

  // 1. AUTH CHECK
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  // 2. VALIDATION
  if (!title || !body) {
    return fail(res, "Title and body required", 400);
  }

  if (userId && !isValidObjectId(userId)) {
    return fail(res, "Invalid userId", 400);
  }

  const payload = {
    title: String(title).trim(),
    body: String(body).trim(),
    type: type || "info",
    audience: audience || (userId ? "private" : "all"),
    userId: userId || null,
  };

  // 3. SAFE CREATE (non-blocking future ready)
  await createNotification(payload);

  return ok(res, { sent: true }, "Notification dispatched");
});

// ===============================
// USER NOTIFICATIONS (PAGINATED)
// ===============================
exports.myNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Pagination (cursor-based)
  const { limit = 20, cursor } = req.query;
  const limitNum = Math.min(parseInt(limit) || 20, 50);

  const query = {
    $and: [
      {
        $or: [
          { userId: userId },
          { audience: "all" },
        ],
      },
      { audience: { $ne: "admin" } },
    ],
  };

  if (cursor && isValidObjectId(cursor)) {
    query._id = { $lt: cursor }; // cursor pagination
  }

  const data = await Notification.find(query)
    .sort({ _id: -1 })
    .limit(limitNum)
    .lean();

  return ok(res, {
    items: data,
    nextCursor: data.length ? data[data.length - 1]._id : null,
  }, "Notifications fetched");
});

// ===============================
// ADMIN FEED (SECURE)
// ===============================
exports.adminFeed = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const { limit = 50 } = req.query;
  const limitNum = Math.min(parseInt(limit) || 50, 100);

  const data = await Notification.find({ audience: "admin" })
    .sort({ _id: -1 })
    .limit(limitNum)
    .lean();

  return ok(res, data, "Admin feed");
});

// ===============================
// MARK SINGLE AS READ
// ===============================
exports.markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return fail(res, "Invalid ID", 400);
  }

  const result = await Notification.updateOne(
    { _id: id, userId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  return ok(res, { updated: result.modifiedCount > 0 });
});

// ===============================
// MARK ALL AS READ (OPTIMIZED)
// ===============================
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      userId: req.user._id,
      readAt: null,
    },
    {
      $set: { readAt: new Date() },
    }
  );

  return ok(res, {
    updated: result.modifiedCount,
  }, "All notifications marked as read");
});