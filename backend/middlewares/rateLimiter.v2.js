const redisConfig = require("../config/redis");
const { getExtractionKeys } = require("../utils/ip.util");
const { fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");

const SHADOW_MODE = false;
const MAX_KEY_TTL = 120;

const INCR_EXPIRE_LUA = `
local v = redis.call('INCR', KEYS[1])
if v == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return v
`;

const retryAfter = (windowSec) => {
  const jitter = Math.floor(Math.random() * 3);
  return Math.max(1, windowSec + jitter);
};

const createLimiter = (options) => {
  const {
    windowSec = 60,
    userLimit = 100,
    ipLimit = 200,
    subnetLimit = 500,
    action = "default",
  } = options;

  return async (req, res, next) => {
    // 🔥 SAFE ACCESS
    const redis = redisConfig.redis || (redisConfig.rawClient ? redisConfig.rawClient : null);
    
    if (!redis || redis.status !== "ready") return next();

    const { userId, ip, subnet } = getExtractionKeys(req);
    const now = Math.floor(Date.now() / 1000);
    const windowKey = Math.floor(now / windowSec);
    const ttl = Math.min(windowSec * 2, MAX_KEY_TTL);

    const userKey = userId ? `rl:u:${userId}:${action}:${windowKey}` : null;
    const ipKey = `rl:i:${ip}:${action}:${windowKey}`;
    const subnetKey = `rl:s:${subnet}:${action}:${windowKey}`;

    try {
      const pipeline = redis.pipeline();
      if (userKey) pipeline.eval(INCR_EXPIRE_LUA, 1, userKey, ttl);
      pipeline.eval(INCR_EXPIRE_LUA, 1, ipKey, ttl);
      pipeline.eval(INCR_EXPIRE_LUA, 1, subnetKey, ttl);

      const results = await Promise.race([
        pipeline.exec(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis Timeout")), 1000))
      ]);

      let idx = 0;
      const userCount = userKey ? results[idx++][1] : 0;
      const ipCount = results[idx++][1];
      const subnetCount = results[idx++][1];

      const blocked =
        (userKey && userCount > userLimit) ||
        ipCount > ipLimit ||
        subnetCount > subnetLimit;

      if (blocked) {
        logger.warn("[RATE_LIMIT_HIT]", { action, userId, ip, userCount, ipCount });
        if (SHADOW_MODE) return next();

        const ra = retryAfter(windowSec);
        res.setHeader("Retry-After", String(ra));
        return fail(res, "Too many requests. Please try again later.", 429);
      }

      return next();
    } catch (err) {
      logger.error("[RATE_LIMIT_ERROR]", { message: err.message });
      return next();
    }
  };
};

const authLimiter = createLimiter({
  windowSec: 300,
  userLimit: 10,
  ipLimit: 20,
  subnetLimit: 50,
  action: "auth",
});

const apiLimiter = createLimiter({
  windowSec: 60,
  userLimit: 100,
  ipLimit: 200,
  subnetLimit: 500,
  action: "api",
});

const dashboardLimiter = createLimiter({
  windowSec: 60,
  userLimit: 300,
  ipLimit: 500,
  subnetLimit: 1000,
  action: "dashboard",
});

module.exports = {
  authLimiter,
  apiLimiter,
  dashboardLimiter,
  uploadLimiter: (req, res, next) => next(),
  healthLimiter: (req, res, next) => next(),
};