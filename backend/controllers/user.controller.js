const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const User = require("../models/user.model");
const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_TTL = 300; // 5 min

// ===============================
// HELPER: GET USER ID SAFE
// ===============================
const getUserId = (req) => {
  return req.user?.id || req.user?._id;
};

// ===============================
// PROFILE (CACHED)
// ===============================
exports.profile = asyncHandler(async (req, res) => {
  const userId = getUserId(req);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return fail(res, "Invalid user", 400);
  }

  const cacheKey = `user:profile:${userId}`;

  // 1. CACHE CHECK
  const cached = await safeCall((r) => r.get(cacheKey));
  if (cached) {
    return ok(res, JSON.parse(cached), "Profile (cache)");
  }

  // 2. DB FETCH
  const user = await User.findById(userId)
    .select("-password -refreshTokens")
    .lean();

  if (!user) {
    return fail(res, "User not found", 404);
  }

  // 3. CACHE SET (ASYNC)
  safeCall((r) =>
    r.set(cacheKey, JSON.stringify(user), "EX", CACHE_TTL)
  );

  return ok(res, user, "Profile fetched");
});

// ===============================
// SAVE FCM TOKEN (MULTI-DEVICE SAFE)
// ===============================
exports.saveFcmToken = asyncHandler(async (req, res) => {
  const { token, deviceId } = req.body;
  const userId = getUserId(req);

  // VALIDATION
  if (!token || typeof token !== "string" || token.length < 20) {
    return fail(res, "Invalid FCM token", 400);
  }

  if (!deviceId || typeof deviceId !== "string") {
    return fail(res, "Device ID required", 400);
  }

  // Store multiple device tokens safely
  await User.updateOne(
    { _id: userId },
    {
      $addToSet: {
        fcmTokens: {
          token,
          deviceId,
          updatedAt: new Date(),
        },
      },
    }
  );

  // OPTIONAL: Clean old tokens (limit 5 devices)
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        fcmTokens: {
          $each: [],
          $slice: -5,
        },
      },
    }
  );

  // CACHE INVALIDATE
  safeCall((r) => r.del(`user:profile:${userId}`));

  logger.info("[FCM_TOKEN_SAVED]", { userId });

  return ok(res, { saved: true }, "FCM token stored");
});