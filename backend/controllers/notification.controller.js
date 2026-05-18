const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const { ok, fail } = require("../utils/apiResponse");
const Notification = require("../models/notification.model");
const { createNotification } = require("../services/notification.service");
const { logger } = require("../utils/logger");

const ALLOWED_TYPES = new Set(["order", "payment", "offer", "system", "product"]);
const ALLOWED_AUDIENCES = new Set(["private", "all", "admin"]);
const ALLOWED_PRIORITIES = new Set(["low", "normal", "high"]);

const clean = (value = "") => String(value ?? "").trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const getUserId = (req) => req.user?._id || req.user?.id;
const parseLimit = (value, fallback, max) => Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);

const hasRead = (notification, userId) => {
  if (!userId) return null;
  const readBy = Array.isArray(notification?.readBy) ? notification.readBy : [];
  const hit = readBy.find((entry) => String(entry.userId) === String(userId));
  return hit?.readAt || null;
};

const serializeNotification = (notification, userId = null) => {
  const readAt = hasRead(notification, userId);

  return {
    ...notification,
    id: String(notification._id || notification.id || ""),
    readAt,
    isRead: Boolean(readAt),
  };
};

const normalizePayload = (body = {}) => {
  const title = clean(body.title);
  const textBody = clean(body.body || body.message);
  const userId = clean(body.userId);
  const audience = clean(body.audience || (userId ? "private" : "all")).toLowerCase();
  const type = clean(body.type || "system").toLowerCase();
  const priority = clean(body.priority || "normal").toLowerCase();

  if (!title || !textBody) throw new Error("Title and body required");
  if (title.length > 150) throw new Error("Title is too long");
  if (textBody.length > 500) throw new Error("Body is too long");
  if (userId && !isValidObjectId(userId)) throw new Error("Invalid userId");
  if (!ALLOWED_AUDIENCES.has(audience)) throw new Error("Invalid audience");
  if (!ALLOWED_TYPES.has(type)) throw new Error("Invalid notification type");
  if (!ALLOWED_PRIORITIES.has(priority)) throw new Error("Invalid priority");
  if (audience === "private" && !userId) throw new Error("userId is required for private notifications");

  return {
    title,
    body: textBody,
    type,
    audience,
    priority,
    userId: userId || null,
    meta: body.meta && typeof body.meta === "object" ? body.meta : {},
  };
};

exports.sendNotification = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  let payload;
  try {
    payload = normalizePayload(req.body);
  } catch (err) {
    return fail(res, err.message, 400);
  }

  const created = await createNotification(payload);

  return ok(res, {
    sent: true,
    notification: serializeNotification(created.toObject ? created.toObject() : created),
  }, "Notification dispatched");
});

exports.myNotifications = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return fail(res, "Unauthorized", 401);

  const limitNum = parseLimit(req.query.limit, 20, 50);
  const cursor = clean(req.query.cursor);

  const query = {
    isDeleted: false,
    $and: [
      { $or: [{ userId }, { audience: "all" }] },
      { audience: { $ne: "admin" } },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    ],
  };

  if (cursor && isValidObjectId(cursor)) {
    query._id = { $lt: cursor };
  }

  const data = await Notification.find(query)
    .sort({ _id: -1 })
    .limit(limitNum)
    .lean();

  const items = data.map((item) => serializeNotification(item, userId));
  const unreadCount = items.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);

  return ok(res, {
    items,
    notifications: items,
    unreadCount,
    nextCursor: data.length === limitNum ? String(data[data.length - 1]._id) : null,
  }, "Notifications fetched");
});

exports.adminFeed = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const limitNum = parseLimit(req.query.limit, 50, 100);
  const cursor = clean(req.query.cursor);
  const query = { audience: "admin", isDeleted: false };

  if (cursor && isValidObjectId(cursor)) {
    query._id = { $lt: cursor };
  }

  const data = await Notification.find(query)
    .sort({ _id: -1 })
    .limit(limitNum)
    .lean();

  const items = data.map((item) => serializeNotification(item));

  return ok(res, {
    items,
    notifications: items,
    nextCursor: data.length === limitNum ? String(data[data.length - 1]._id) : null,
  }, "Admin feed");
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!userId) return fail(res, "Unauthorized", 401);
  if (!isValidObjectId(id)) return fail(res, "Invalid ID", 400);

  const result = await Notification.updateOne(
    {
      _id: id,
      isDeleted: false,
      audience: { $ne: "admin" },
      $or: [{ userId }, { audience: "all" }],
      "readBy.userId": { $ne: userId },
    },
    { $push: { readBy: { userId, readAt: new Date() } } }
  );

  return ok(res, {
    updated: result.modifiedCount > 0,
  }, "Notification marked as read");
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return fail(res, "Unauthorized", 401);

  const unread = await Notification.find({
    isDeleted: false,
    audience: { $ne: "admin" },
    $or: [{ userId }, { audience: "all" }],
    "readBy.userId": { $ne: userId },
  })
    .select("_id")
    .limit(500)
    .lean();

  if (!unread.length) {
    return ok(res, { updated: 0 }, "All notifications marked as read");
  }

  const ids = unread.map((item) => item._id);
  const result = await Notification.updateMany(
    { _id: { $in: ids }, "readBy.userId": { $ne: userId } },
    { $push: { readBy: { userId, readAt: new Date() } } }
  );

  logger.info("NOTIFICATIONS_MARK_ALL", { userId: String(userId), count: result.modifiedCount });

  return ok(res, {
    updated: result.modifiedCount,
  }, "All notifications marked as read");
});
