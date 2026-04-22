const redis = require("../config/redis");
const env = require("../config/env");
const { fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");

// ===============================
// CONFIG
// ===============================
const PAYMENT_LIMIT = 5;
const WINDOW = 3600; // 1 hour
const SIGNATURE_LIMIT = 3;
const BLOCK_WINDOW = 86400; // 24 hours

// ===============================
// HELPER: SAFE IP (PROXY SAFE)
// ===============================
const getIp = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown"
  );
};

// ===============================
// HELPER: REDIS SAFE
// ===============================
const isRedisReady = () =>
  redis && redis.status === "ready";

// ===============================
// PAYMENT RATE LIMIT
// ===============================
exports.paymentRateLimit = async (req, res, next) => {
  if (!isRedisReady()) return next();

  const ip = getIp(req);
  const userId = req.user?._id || "guest";

  const key = `fraud:pay:${userId}:${ip}`;

  try {
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, WINDOW);
    }

    if (attempts > PAYMENT_LIMIT) {
      logger.warn("[FRAUD_RATE_LIMIT]", {
        ip,
        userId,
        attempts,
      });

      return fail(
        res,
        "Too many payment attempts. Try again later.",
        429
      );
    }
  } catch (err) {
    logger.error("[FRAUD_RATE_ERROR]", err.message);
  }

  next();
};

// ===============================
// SIGNATURE FAILURE TRACK
// ===============================
exports.trackSignatureFailure = async (identifier) => {
  if (!isRedisReady()) return;

  const key = `fraud:sig:${identifier}`;

  try {
    const failures = await redis.incr(key);

    if (failures === 1) {
      await redis.expire(key, BLOCK_WINDOW);
    }

    if (failures >= SIGNATURE_LIMIT) {
      logger.error("[FRAUD_SIGNATURE_BLOCK]", {
        identifier,
        failures,
      });

      // Future: push to DB / alert system
    }
  } catch (err) {
    logger.error("[FRAUD_SIG_ERROR]", err.message);
  }
};

// ===============================
// BLOCK CHECK
// ===============================
exports.checkFraudBlock = async (req, res, next) => {
  if (!isRedisReady()) return next();

  const ip = getIp(req);
  const userId = req.user?._id || null;

  try {
    const [ipFail, userFail] = await Promise.all([
      redis.get(`fraud:sig:${ip}`),
      userId ? redis.get(`fraud:sig:${userId}`) : "0",
    ]);

    if (
      parseInt(ipFail || 0) >= SIGNATURE_LIMIT ||
      parseInt(userFail || 0) >= SIGNATURE_LIMIT
    ) {
      logger.error("[FRAUD_BLOCKED]", {
        ip,
        userId,
      });

      return fail(
        res,
        "Payment access temporarily blocked due to suspicious activity.",
        403
      );
    }
  } catch (err) {
    logger.error("[FRAUD_BLOCK_ERROR]", err.message);
  }

  next();
};

// ===============================
// GLOBAL RATE LIMIT (ADVANCED)
// ===============================
exports.globalRateLimit = async (req, res, next) => {
  if (!isRedisReady()) return next();

  const key = "fraud:global";

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 60); // 1 min window
    }

    if (count > 1000) {
      logger.error("[FRAUD_GLOBAL_SPIKE]", { count });

      return fail(
        res,
        "Server busy. Try again later.",
        503
      );
    }
  } catch (err) {
    logger.error("[FRAUD_GLOBAL_ERROR]", err.message);
  }

  next();
};