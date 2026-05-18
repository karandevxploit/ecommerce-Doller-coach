const redisConfig = require("../config/redis");
const { getExtractionKeys } = require("../utils/ip.util");
const { fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");

const SHADOW_MODE = String(process.env.RATE_LIMIT_SHADOW_MODE || "false").toLowerCase() === "true";
const MAX_KEY_TTL = Number(process.env.RATE_LIMIT_MAX_KEY_TTL || 900);
const localBuckets = new Map();

const retryAfter = (windowSec) => Math.max(1, Number(windowSec || 60));

const increment = async (key, ttl) => {
  if (!redisConfig.isReady?.()) {
    const now = Date.now();
    const existing = localBuckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      localBuckets.set(key, { count: 1, expiresAt: now + ttl * 1000 });
      return 1;
    }

    existing.count += 1;
    return existing.count;
  }

  const value = await redisConfig.safeCall(async (r) => {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, ttl);
    return count;
  });

  return Number(value || 0);
};

const setHeaders = (res, { limit, count, windowSec }) => {
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - count)));
  res.setHeader("RateLimit-Reset", String(retryAfter(windowSec)));
};

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of localBuckets.entries()) {
    if (!bucket || bucket.expiresAt <= now) localBuckets.delete(key);
  }
}, 60000).unref?.();

const createLimiter = ({
  windowSec = 60,
  userLimit = 100,
  ipLimit = 200,
  subnetLimit = 500,
  action = "default",
  skip = null,
} = {}) => {
  const ttl = Math.min(Math.max(1, Number(windowSec) * 2), MAX_KEY_TTL);

  return async (req, res, next) => {
    if (process.env.NODE_ENV === "test") return next();
    if (skip?.(req) || ["/health", "/metrics"].includes(req.path)) return next();

    const { userId, ip, subnet } = getExtractionKeys(req);
    const windowKey = Math.floor(Date.now() / 1000 / Number(windowSec || 60));

    const keys = [
      userId ? { type: "user", key: `rl:u:${userId}:${action}:${windowKey}`, limit: userLimit } : null,
      { type: "ip", key: `rl:i:${ip}:${action}:${windowKey}`, limit: ipLimit },
      { type: "subnet", key: `rl:s:${subnet}:${action}:${windowKey}`, limit: subnetLimit },
    ].filter(Boolean);

    try {
      const counts = await Promise.all(keys.map((item) => increment(item.key, ttl)));
      const checks = keys.map((item, index) => ({ ...item, count: counts[index] }));
      const exceeded = checks.find((item) => item.count > item.limit);
      const primary = checks[0] || { limit: ipLimit, count: 0 };

      setHeaders(res, {
        limit: primary.limit,
        count: primary.count,
        windowSec,
      });

      if (exceeded) {
        logger.warn("[RATE_LIMIT_HIT]", {
          action,
          scope: exceeded.type,
          userId,
          ip,
          count: exceeded.count,
          limit: exceeded.limit,
        });

        if (SHADOW_MODE) return next();

        const ra = retryAfter(windowSec);
        res.setHeader("Retry-After", String(ra));
        return fail(res, "Too many requests. Please try again later.", 429);
      }

      return next();
    } catch (err) {
      logger.warn("[RATE_LIMIT_ERROR]", { action, message: err.message });
      return next();
    }
  };
};

const authLimiter = createLimiter({
  windowSec: 300,
  userLimit: Number(process.env.AUTH_USER_LIMIT || 20),
  ipLimit: Number(process.env.AUTH_IP_LIMIT || 40),
  subnetLimit: Number(process.env.AUTH_SUBNET_LIMIT || 120),
  action: "auth",
});

const apiLimiter = createLimiter({
  windowSec: 60,
  userLimit: Number(process.env.API_USER_LIMIT || 400),
  ipLimit: Number(process.env.API_IP_LIMIT || 800),
  subnetLimit: Number(process.env.API_SUBNET_LIMIT || 2400),
  action: "api",
});

const dashboardLimiter = createLimiter({
  windowSec: 60,
  userLimit: Number(process.env.DASHBOARD_USER_LIMIT || 600),
  ipLimit: Number(process.env.DASHBOARD_IP_LIMIT || 1200),
  subnetLimit: Number(process.env.DASHBOARD_SUBNET_LIMIT || 3000),
  action: "dashboard",
});

const uploadLimiter = createLimiter({
  windowSec: 300,
  userLimit: Number(process.env.UPLOAD_USER_LIMIT || 80),
  ipLimit: Number(process.env.UPLOAD_IP_LIMIT || 120),
  subnetLimit: Number(process.env.UPLOAD_SUBNET_LIMIT || 300),
  action: "upload",
});

const healthLimiter = createLimiter({
  windowSec: 60,
  userLimit: 1000,
  ipLimit: 2000,
  subnetLimit: 5000,
  action: "health",
});

module.exports = {
  authLimiter,
  apiLimiter,
  dashboardLimiter,
  uploadLimiter,
  healthLimiter,
  createLimiter,
};
