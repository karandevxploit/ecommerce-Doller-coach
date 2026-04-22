const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redis } = require("../config/redis");
const { logger } = require("../utils/logger");

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

// ===============================
// HELPER: KEY GENERATOR
// ===============================
const keyGenerator = (req) => {
  const ip = getIp(req);
  const userId = req.user?._id || "guest";
  return `${userId}:${ip}`;
};

// ===============================
// REDIS STORE (FAIL-SAFE)
// ===============================
const createRedisStore = (prefix) => {
  if (process.env.REDIS_ENABLED !== "true") return undefined;

  return new RedisStore({
    sendCommand: async (...args) => {
      try {
        if (!redis || redis.status !== "ready") return 0;
        return await redis.call(...args);
      } catch (err) {
        logger.warn("[RATE_LIMIT_REDIS_ERROR]", err.message);
        return 0;
      }
    },
    prefix,
  });
};

// ===============================
// MAIN FACTORY
// ===============================
const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,

    keyGenerator,

    store: createRedisStore(options.prefix),

    standardHeaders: true,
    legacyHeaders: false,

    passOnStoreError: true,

    skip: (req) => {
      // skip internal / health routes
      return ["/health", "/metrics"].includes(req.path);
    },

    handler: (req, res, next, opt) => {
      const ip = getIp(req);

      logger.warn("[RATE_LIMIT_HIT]", {
        ip,
        userId: req.user?._id || null,
        route: req.originalUrl
      });

      res.setHeader("Retry-After", Math.ceil(opt.windowMs / 1000));

      return res.status(opt.statusCode).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      });
    },
  });
};

// ===============================
// LIMITERS
// ===============================

// General API (high throughput)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  prefix: "rl:api:",
});

// Auth (strict)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "rl:auth:",
});

// Payment (very strict)
const paymentLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  prefix: "rl:payment:",
});

// ===============================
// EXPORTS
// ===============================
module.exports = {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  identityLimiter: authLimiter,
  createRateLimiter,
};