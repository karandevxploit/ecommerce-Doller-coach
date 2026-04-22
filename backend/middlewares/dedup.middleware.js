const { redis } = require("../config/redis");
const { logger } = require("../utils/logger");

/**
 * Deduplication Middleware
 * 
 * Prevents duplicate requests (POST/PUT/DELETE) within a short window (1s).
 * This stops UI spam and accidental double orders/payments.
 */
exports.dedup = (ttlWindow = 1) => async (req, res, next) => {
  if (!redis || redis.status !== "ready") return next();

  // Only dedup non-GET requests (mutating state)
  if (req.method === "GET") return next();

  const userId = req.user?.id || req.ip;
  const hash = require("crypto").createHash("md5")
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body)}`)
    .digest("hex");

  const lockKey = `lock:${userId}:${hash}`;

  try {
    const isLocked = await redis.set(lockKey, "1", "EX", ttlWindow, "NX");

    if (!isLocked) {
      logger.warn("[REQUEST_DEDUPLICATED]", { 
        userId, 
        path: req.originalUrl,
        method: req.method 
      });

      return res.status(409).json({
        success: false,
        message: "Request already being processed. Please wait.",
        code: "DUPLICATE_REQUEST"
      });
    }
  } catch (err) {
    logger.error("[DEDUP_ERROR]", err.message);
  }

  next();
};
