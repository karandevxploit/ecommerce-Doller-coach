const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const User = require("../models/user.model");
const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_TTL = 300;
const PROFILE_FIELDS =
  "name email phone role avatar emailVerified phoneVerified isVerified provider addresses defaultAddressId devices lastLoginAt createdAt updatedAt";

const getUserId = (req) => req.user?.id || req.user?._id || req.user?.userId;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const serializeUser = (user = {}) => ({
  ...user,
  id: String(user._id || user.id || ""),
  _id: String(user._id || user.id || ""),
  role: String(user.role || "user").toLowerCase(),
  isVerified: Boolean(user.isVerified || user.emailVerified || user.phoneVerified),
  devices: Array.isArray(user.devices)
    ? user.devices.map((device) => ({
        deviceId: device.deviceId || "",
        lastUsed: device.lastUsed || device.updatedAt || null,
      }))
    : [],
});

const invalidateUserCache = async (userId) => {
  await safeCall((r) => r.del(`user:profile:${userId}`));
};

// ===============================
// PROFILE
// ===============================
exports.profile = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!isObjectId(userId)) {
    return fail(res, "Invalid user", 400);
  }

  const cacheKey = `user:profile:${userId}`;
  const cached = safeJsonParse(await safeCall((r) => r.get(cacheKey)));

  if (cached) {
    return ok(res, cached, "Profile fetched");
  }

  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
    .select(PROFILE_FIELDS)
    .populate("defaultAddressId")
    .lean();

  if (!user) {
    return fail(res, "User not found", 404);
  }

  const payload = serializeUser(user);

  safeCall((r) => r.set(cacheKey, JSON.stringify(payload), "EX", CACHE_TTL));

  return ok(res, payload, "Profile fetched");
});

// ===============================
// SAVE FCM TOKEN
// ===============================
exports.saveFcmToken = asyncHandler(async (req, res) => {
  const { token, deviceId = "default" } = req.body || {};
  const userId = getUserId(req);
  const safeToken = String(token || "").trim();
  const safeDeviceId = String(deviceId || "default").trim().slice(0, 120);

  if (!isObjectId(userId)) return fail(res, "Invalid user", 400);
  if (!safeToken || safeToken.length < 20 || safeToken.length > 4096) {
    return fail(res, "Invalid FCM token", 400);
  }
  if (!safeDeviceId) return fail(res, "Device ID required", 400);

  const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).select("devices");
  if (!user) return fail(res, "User not found", 404);

  const devices = Array.isArray(user.devices) ? user.devices : [];
  const existingIndex = devices.findIndex((device) => device.deviceId === safeDeviceId);
  const nextDevice = {
    fcmToken: safeToken,
    deviceId: safeDeviceId,
    lastUsed: new Date(),
  };

  if (existingIndex >= 0) {
    devices[existingIndex] = nextDevice;
  } else {
    devices.push(nextDevice);
  }

  user.devices = devices
    .filter((device) => device?.fcmToken && device?.deviceId)
    .slice(-5);

  await user.save();
  await invalidateUserCache(userId);

  logger.info("[FCM_TOKEN_SAVED]", { userId: String(userId), deviceId: safeDeviceId });

  return ok(
    res,
    {
      saved: true,
      deviceCount: user.devices.length,
    },
    "FCM token stored"
  );
});
