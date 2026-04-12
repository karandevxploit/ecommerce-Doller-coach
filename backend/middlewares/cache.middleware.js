const redis = require("../config/redis");
const logger = require("../utils/logger");
const env = require("../config/env");

/**
 * PRODUCTION-GRADE CACHING MIDDLEWARE
 * - Uses cache-aside pattern.
 * - Automatic fallback to DB if Redis is offline.
 * - Optimized for high-concurrency (JSON serialization).
 */
exports.cacheRoute = (ttl) => async (req, res, next) => {
  if (env.NODE_ENV === "test" || req.method !== "GET" || !redis) {
    return next();
  }

  // Structured Key: cache:method:path:queryhash
  const queryStr = JSON.stringify(req.query || {});
  const key = `cache:${req.method}:${req.baseUrl}${req.path}:${queryStr}`;

  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.info(`Cache HIT: ${req.originalUrl}`);
      return res.json(JSON.parse(cached));
    }

    logger.info(`Cache MISS: ${req.originalUrl}. Fetching from DB...`);
    
    // Intercept res.json to store the result in cache
    const originalJson = res.json;
    res.json = function (body) {
      if (res.statusCode === 200) {
        // Background cache population (non-blocking)
        redis.setex(key, ttl || 300, JSON.stringify(body)).catch((err) => {
          logger.error("Redis Cache Population Failed", { error: err.message });
        });
      }
      return originalJson.call(this, body);
    };
  } catch (error) {
    logger.error("Cache Middleware Error (Falling back to DB)", { error: error.message });
  }

  next();
};

/**
 * CACHE INVALIDATION UTILITY
 */
exports.invalidateCache = async (pattern) => {
  if (!redis) return;
  try {
    const keys = await redis.keys(`cache:*${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cache INVALIDATED for pattern: ${pattern}. Keys removed: ${keys.length}`);
    }
  } catch (error) {
    logger.error("Cache Invalidation Failed", { error: error.message });
  }
};
