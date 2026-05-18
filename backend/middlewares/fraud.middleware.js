const crypto = require("crypto");

const redis = require("../config/redis");
const { fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");

const PAYMENT_LIMIT = Number(process.env.PAYMENT_ATTEMPT_LIMIT || 12);
const PAYMENT_WINDOW_SECONDS = Number(process.env.PAYMENT_ATTEMPT_WINDOW_SECONDS || 3600);
const SIGNATURE_LIMIT = Number(process.env.PAYMENT_SIGNATURE_FAILURE_LIMIT || 3);
const SIGNATURE_WINDOW_SECONDS = Number(process.env.PAYMENT_SIGNATURE_BLOCK_SECONDS || 86400);
const GLOBAL_LIMIT = Number(process.env.PAYMENT_GLOBAL_LIMIT_PER_MINUTE || 2000);

const hash = (value) =>
  crypto.createHash("sha256").update(String(value || "unknown")).digest("hex").slice(0, 24);

const getIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || "").split(",")[0];

  return (
    forwardedIp?.trim() ||
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
};

const getUserId = (req) => req.user?._id || req.user?.id || req.user?.userId || null;

const isReady = () => Boolean(redis.isReady?.());

const incrementWindow = async (key, ttlSeconds) => {
  if (!isReady()) return 0;

  const count = await redis.safeCall(async (r) => {
    const value = await r.incr(key);
    if (value === 1) await r.expire(key, ttlSeconds);
    return value;
  });

  return Number(count || 0);
};

const getCount = async (key) => {
  if (!isReady()) return 0;
  return Number((await redis.get(key)) || 0);
};

const signatureKey = (identifier) => `fraud:sig:${hash(identifier)}`;
const signatureBlockKey = (identifier) => `fraud:block:${hash(identifier)}`;

// ===============================
// PAYMENT RATE LIMIT
// ===============================
exports.paymentRateLimit = async (req, res, next) => {
  if (!isReady()) return next();

  const ip = getIp(req);
  const userId = getUserId(req) || "guest";
  const key = `fraud:pay:${hash(userId)}:${hash(ip)}`;

  try {
    const attempts = await incrementWindow(key, PAYMENT_WINDOW_SECONDS);

    if (attempts > PAYMENT_LIMIT) {
      logger.warn("[FRAUD_RATE_LIMIT]", {
        ip,
        userId,
        attempts,
      });

      return fail(res, "Too many payment attempts. Try again later.", 429);
    }
  } catch (err) {
    logger.warn("[FRAUD_RATE_ERROR]", { message: err.message });
  }

  return next();
};

// ===============================
// SIGNATURE FAILURE TRACK
// ===============================
exports.trackSignatureFailure = async (identifier) => {
  if (!identifier || !isReady()) return 0;

  const key = signatureKey(identifier);

  try {
    const failures = await incrementWindow(key, SIGNATURE_WINDOW_SECONDS);

    if (failures >= SIGNATURE_LIMIT) {
      await redis.safeCall((r) =>
        r.set(signatureBlockKey(identifier), "1", "EX", SIGNATURE_WINDOW_SECONDS)
      );

      logger.error("[FRAUD_SIGNATURE_BLOCK]", {
        identifier: hash(identifier),
        failures,
      });
    }

    return failures;
  } catch (err) {
    logger.warn("[FRAUD_SIG_ERROR]", { message: err.message });
    return 0;
  }
};

// ===============================
// BLOCK CHECK
// ===============================
exports.checkFraudBlock = async (req, res, next) => {
  if (!isReady()) return next();

  const ip = getIp(req);
  const userId = getUserId(req);

  try {
    const checks = [
      redis.get(signatureBlockKey(ip)),
      getCount(signatureKey(ip)),
    ];

    if (userId) {
      checks.push(redis.get(signatureBlockKey(userId)), getCount(signatureKey(userId)));
    }

    const values = await Promise.all(checks);
    const blocked =
      values.some((value) => value === "1") ||
      values.some((value) => Number(value || 0) >= SIGNATURE_LIMIT);

    if (blocked) {
      logger.error("[FRAUD_BLOCKED]", {
        ip,
        userId,
      });

      return fail(res, "Payment access temporarily blocked due to suspicious activity.", 403);
    }
  } catch (err) {
    logger.warn("[FRAUD_BLOCK_ERROR]", { message: err.message });
  }

  return next();
};

// ===============================
// GLOBAL RATE LIMIT
// ===============================
exports.globalRateLimit = async (req, res, next) => {
  if (!isReady()) return next();

  try {
    const count = await incrementWindow("fraud:global:payments", 60);

    if (count > GLOBAL_LIMIT) {
      logger.error("[FRAUD_GLOBAL_SPIKE]", { count });
      return fail(res, "Server busy. Try again later.", 503);
    }
  } catch (err) {
    logger.warn("[FRAUD_GLOBAL_ERROR]", { message: err.message });
  }

  return next();
};

exports._private = {
  getIp,
  signatureKey,
  signatureBlockKey,
};
