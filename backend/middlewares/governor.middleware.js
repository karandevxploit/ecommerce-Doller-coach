const redis = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Protocol Governor Middleware
 * Detects and suppresses high-frequency request loops at the infrastructure level.
 */
const governor = async (req, res, next) => {
  // Use IP or Session ID as target
  const target = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const rpsKey = `governor:rps:${target}`;
  const lockKey = `governor:lock:${target}`;

  try {
    // 1. Check if already locked
    const isLocked = await redis.get(lockKey);
    if (isLocked) {
      return res.status(429).json({
        success: false,
        message: "Protocol Lock Active. System stabilization in progress. Please wait 5 minutes.",
        type: "GOVERNOR_LOCK"
      });
    }

    // 2. Increment RPS (1-second sliding window)
    const count = await redis.incr(rpsKey);
    if (count === 1) await redis.expire(rpsKey, 1);

    // 3. Threshold Violation Detection
    // 20 req/s is the caution threshold, 50 req/s is the emergency lock threshold
    if (count > 50) {
      await redis.setex(lockKey, 300, "1"); // 5m lock
      logger.error(`[GOVERNOR] Protocol Violation: IP ${target} exceeded 50 requests/sec. Activating 5m Protocol Lock.`);
      return res.status(429).json({
        success: false,
        message: "Emergency Protocol Lock Activated. Excessive request frequency detected.",
        type: "EMERGENCY_LOCK"
      });
    }

    next();
  } catch (err) {
    // Fail-Safe: If Redis is down, don't block traffic
    next();
  }
};

module.exports = governor;
