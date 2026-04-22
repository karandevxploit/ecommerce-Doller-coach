const { redis } = require("../config/redis");
const { logger } = require("../utils/logger");
const env = require("../config/env");
const crypto = require("crypto");
const zlib = require("zlib");

// ===============================
// CONFIG
// ===============================
const DEFAULT_TTL = 300;
const MAX_PAYLOAD_SIZE = 200 * 1024; // 200KB

// ===============================
// HELPERS
// ===============================

// Stable hash key (prevents long keys)
const buildKey = (req) => {
  const canonicalQuery = Object.keys(req.query || {})
    .sort()
    .reduce((acc, k) => {
      acc[k] = req.query[k];
      return acc;
    }, {});

  const raw = `${req.method}:${req.baseUrl}${req.path}:${JSON.stringify(canonicalQuery)}`;

  return "cache:" + crypto.createHash("sha1").update(raw).digest("hex");
};

// Compress payload
const compress = (data) => {
  try {
    return zlib.gzipSync(JSON.stringify(data)).toString("base64");
  } catch {
    return null;
  }
};

// Decompress payload
const decompress = (data) => {
  try {
    const buffer = Buffer.from(data, "base64");
    return JSON.parse(zlib.gunzipSync(buffer).toString());
  } catch {
    return null;
  }
};

// ===============================
// CACHE MIDDLEWARE
// ===============================
exports.cacheRoute = (ttl = DEFAULT_TTL) => async (req, res, next) => {
  if (
    env.NODE_ENV === "test" ||
    req.method !== "GET" ||
    !redis ||
    redis.status !== "ready"
  ) {
    return next();
  }

  const key = buildKey(req);

  try {
    const cached = await Promise.race([
      redis.get(key),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis Timeout")), 1000))
    ]);

    if (cached) {
      const data = decompress(cached);

      if (data) {
        logger.info("[CACHE_HIT]", { url: req.originalUrl });
        return res.json(data);
      }
    }

    logger.info("[CACHE_MISS]", { url: req.originalUrl });

    const originalJson = res.json;

    res.json = function (body) {
      try {
        if (res.statusCode === 200) {
          const payload = JSON.stringify(body);

          // Avoid caching huge responses
          if (payload.length < MAX_PAYLOAD_SIZE) {
            const compressed = compress(body);

            if (compressed) {
              redis
                .set(key, compressed, "EX", ttl)
                .catch((err) =>
                  logger.error("[CACHE_SET_FAIL]", err.message)
                );
            }
          } else {
            logger.warn("[CACHE_SKIP_LARGE_PAYLOAD]", {
              size: payload.length,
            });
          }
        }
      } catch (err) {
        logger.error("[CACHE_WRITE_ERROR]", err.message);
      }

      return originalJson.call(this, body);
    };
  } catch (err) {
    logger.error("[CACHE_ERROR]", err.message);
  }

  next();
};

// ===============================
// INVALIDATION (OPTIMIZED)
// ===============================
exports.invalidateCache = async (pattern) => {
  if (!redis || redis.status !== "ready") return;

  try {
    let cursor = "0";
    let total = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `cache:*${pattern}*`,
        "COUNT",
        200
      );

      cursor = nextCursor;

      if (keys.length) {
        await redis.del(...keys);
        total += keys.length;
      }
    } while (cursor !== "0");

    logger.info("[CACHE_INVALIDATED]", { pattern, total });
  } catch (err) {
    logger.error("[CACHE_INVALIDATE_ERROR]", err.message);
  }
};

/**
 * Middleware version of invalidation
 */
exports.clearCache = (pattern) => async (req, res, next) => {
  setImmediate(() => {
    exports.invalidateCache(pattern).catch((err) =>
      logger.error("[CACHE_CLEAR_FAIL]", err.message)
    );
  });
  next();
};