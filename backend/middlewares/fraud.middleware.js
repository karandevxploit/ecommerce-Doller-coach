const Redis = require("ioredis");
const env = require("../config/env");
const { fail } = require("../utils/apiResponse");
const logger = require("../utils/logger");

let redis;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL);
}

/**
 * Specialized Fraud Prevention Middleware
 */

// 1. Payment Attempt Rate Limiting (Prevents carding attacks)
exports.paymentRateLimit = async (req, res, next) => {
  if (!redis) return next();

  const ip = req.ip || req.headers["x-forwarded-for"];
  const userId = req.user?._id;
  const key = `fraud:payment_limit:${userId || ip}`;
  
  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, 3600); // 1-hour window
    }

    if (attempts > 5) {
      logger.warn(`SUSPICIOUS ACTIVITY: Too many payment attempts from ${userId || ip}`);
      return fail(res, "Excessive payment attempts. Please wait 1 hour.", 429);
    }
  } catch (err) {
    logger.error("Fraud Check Error:", err);
  }
  
  next();
};

// 2. Signature Failure Tracking (Prevents brute-forcing verification signatures)
exports.trackSignatureFailure = async (identifier) => {
  if (!redis) return;

  const key = `fraud:signature_failures:${identifier}`;
  try {
    const failures = await redis.incr(key);
    if (failures === 1) {
      await redis.expire(key, 86400); // 24-hour ban window
    }

    if (failures >= 3) {
      logger.error(`BLOCKING POTENTIAL ATTACKER: Repeated signature failures for ${identifier}`);
      // In a real app, you might also flag the user account in DB
    }
  } catch (err) {
    logger.error("Failure tracking error:", err);
  }
};

// 3. Block check for known fraud IPs/Users
exports.checkFraudBlock = async (req, res, next) => {
  if (!redis) return next();

  const ip = req.ip;
  const userId = req.user?._id;
  
  try {
    const [ipFailures, userFailures] = await Promise.all([
      redis.get(`fraud:signature_failures:${ip}`),
      userId ? redis.get(`fraud:signature_failures:${userId}`) : "0"
    ]);

    if (parseInt(ipFailures) >= 3 || parseInt(userFailures) >= 3) {
      logger.error(`DENIED ACCESS: Blocked user/IP attempted payment route: ${userId || ip}`);
      return fail(res, "Your account is temporarily restricted from making payments due to suspicious activity.", 403);
    }
  } catch (err) {
    logger.error("Fraud Block Check Error:", err);
  }

  next();
};
