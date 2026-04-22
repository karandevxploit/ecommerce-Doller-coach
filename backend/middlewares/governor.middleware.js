const { redis } = require("../config/redis");
const { logger } = require("../utils/logger");

// ===============================
// CONFIG
// ===============================
const SOFT_LIMIT = 20;     // warn / slow down
const HARD_LIMIT = 50;     // block
const LOCK_TIME = 300;     // 5 min
const WINDOW = 1;          // seconds

// ===============================
// HELPER: SAFE IP
// ===============================
const getIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

const isRedisReady = () =>
  redis && redis.status === "ready";

// ===============================
// GOVERNOR
// ===============================
const governor = async (req, res, next) => {
  if (!isRedisReady()) return next(); // fail-safe

  const ip = getIp(req);
  const userId = req.user?._id || "guest";

  // Hybrid identity (stronger than IP alone)
  const target = `${userId}:${ip}`;

  const rpsKey = `gov:rps:${target}`;
  const lockKey = `gov:lock:${target}`;

  try {
    // ===============================
    // HARD LOCK CHECK
    // ===============================
    const locked = await redis.get(lockKey);
    if (locked) {
      return res.status(429).json({
        success: false,
        code: "GOVERNOR_LOCK",
        message: "Too many requests. Try again later.",
        retryAfter: LOCK_TIME
      });
    }

    // ===============================
    // RPS COUNT (WINDOWED)
    // ===============================
    const count = await redis.incr(rpsKey);
    if (count === 1) {
      await redis.expire(rpsKey, WINDOW);
    }

    // ===============================
    // HARD LIMIT (BLOCK)
    // ===============================
    if (count > HARD_LIMIT) {
      await redis.setex(lockKey, LOCK_TIME, "1");

      logger.error("[GOVERNOR_LOCK_ACTIVATED]", {
        target,
        count
      });

      return res.status(429).json({
        success: false,
        code: "EMERGENCY_LOCK",
        message: "Excessive traffic detected. Temporarily blocked.",
        retryAfter: LOCK_TIME
      });
    }

    // ===============================
    // SOFT LIMIT (THROTTLE)
    // ===============================
    if (count > SOFT_LIMIT) {
      const delay = Math.min(count * 10, 200); // dynamic delay

      logger.warn("[GOVERNOR_THROTTLE]", {
        target,
        count,
        delay
      });

      // Add small delay instead of blocking
      return setTimeout(next, delay);
    }

    next();
  } catch (err) {
    logger.error("[GOVERNOR_ERROR]", err.message);
    next(); // fail-safe
  }
};

module.exports = governor;