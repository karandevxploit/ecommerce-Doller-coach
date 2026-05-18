const crypto = require("crypto");
const zlib = require("zlib");

const redis = require("../config/redis");
const { logger } = require("../utils/logger");
const env = require("../config/env");

const DEFAULT_TTL = Number(process.env.ROUTE_CACHE_TTL_SECONDS || 60);
const MAX_PAYLOAD_SIZE = Number(process.env.ROUTE_CACHE_MAX_BYTES || 200 * 1024);
const CACHE_TIMEOUT_MS = Number(process.env.ROUTE_CACHE_TIMEOUT_MS || 500);

const shouldBypass = (req) =>
  env.NODE_ENV === "test" ||
  req.method !== "GET" ||
  req.headers["cache-control"] === "no-cache" ||
  req.query?.nocache === "1" ||
  !redis.isReady?.();

const stableQuery = (query = {}) =>
  Object.keys(query)
    .filter((key) => !["_", "t", "timestamp", "nocache"].includes(key))
    .sort()
    .reduce((acc, key) => {
      acc[key] = query[key];
      return acc;
    }, {});

const buildRouteKey = (req) => {
  const routePath = `${req.baseUrl || ""}${req.path || ""}`.replace(/\/+/g, "/") || req.originalUrl;
  const routeKey = `${req.method}:${routePath}`;
  const raw = `${routeKey}:${JSON.stringify(stableQuery(req.query || {}))}`;
  const hash = crypto.createHash("sha1").update(raw).digest("hex");

  return `cache:${routeKey}:${hash}`;
};

const withTimeout = (promise, fallback = null) => {
  let timer;

  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), CACHE_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

const encodePayload = (payload) => {
  try {
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json, "utf8") > MAX_PAYLOAD_SIZE) return null;

    const compressed = zlib.gzipSync(json).toString("base64");
    return JSON.stringify({ encoding: "gzip-base64-json", payload: compressed });
  } catch {
    return null;
  }
};

const decodePayload = (value) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (parsed?.encoding === "gzip-base64-json") {
      const json = zlib.gunzipSync(Buffer.from(parsed.payload, "base64")).toString();
      return JSON.parse(json);
    }

    return parsed;
  } catch {
    try {
      const json = zlib.gunzipSync(Buffer.from(value, "base64")).toString();
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
};

const normalizePattern = (pattern = "") => {
  const raw = String(pattern || "").trim();
  if (!raw || raw === "*") return "*";

  const withoutCache = raw.replace(/^cache:\*/, "");
  const normalized = withoutCache.startsWith("/api/")
    ? withoutCache
    : withoutCache.startsWith("/")
      ? withoutCache
      : `/api/${withoutCache}`;

  return normalized.replace(/\/+/g, "/");
};

const patternToMatches = (pattern) => {
  const normalized = normalizePattern(pattern);
  if (normalized === "*") return ["cache:*"];

  return [
    `cache:*${normalized}*`,
    `cache:*${normalized.replace(/^\/api\//, "/")}*`,
    `cache:*${normalized.split("/").filter(Boolean).pop()}*`,
  ];
};

exports.buildKey = buildRouteKey;

// ===============================
// CACHE MIDDLEWARE
// ===============================
exports.cacheRoute = (ttl = DEFAULT_TTL) => async (req, res, next) => {
  if (shouldBypass(req)) return next();

  const key = buildRouteKey(req);

  try {
    const cached = decodePayload(await withTimeout(redis.get(key), null));

    if (cached) {
      res.setHeader("x-cache", "HIT");
      return res.status(200).json(cached);
    }

    res.setHeader("x-cache", "MISS");
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      try {
        const cacheable =
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          body &&
          body.success !== false;

        if (cacheable) {
          const encoded = encodePayload(body);
          if (encoded) {
            withTimeout(redis.set(key, encoded, "EX", ttl), null).catch((err) => {
              logger.warn("[CACHE_SET_FAIL]", { key, message: err.message });
            });
          }
        }
      } catch (err) {
        logger.warn("[CACHE_WRITE_ERROR]", { key, message: err.message });
      }

      return originalJson(body);
    };
  } catch (err) {
    logger.warn("[CACHE_ERROR]", { key, message: err.message });
  }

  return next();
};

// ===============================
// INVALIDATION
// ===============================
exports.invalidateCache = async (pattern = "*") => {
  if (!redis.isReady?.()) return 0;

  const matches = [...new Set(patternToMatches(pattern))];
  let total = 0;

  for (const match of matches) {
    let cursor = "0";

    do {
      try {
        const result = await withTimeout(
          redis.safeCall((r) => r.scan(cursor, "MATCH", match, "COUNT", 200)),
          null
        );

        if (!result) break;

        const [nextCursor, keys = []] = result;
        cursor = nextCursor;

        if (keys.length) {
          await withTimeout(redis.safeCall((r) => r.del(...keys)), null);
          total += keys.length;
        }
      } catch (err) {
        logger.warn("[CACHE_INVALIDATE_ERROR]", { pattern, match, message: err.message });
        break;
      }
    } while (cursor !== "0");
  }

  if (total > 0) {
    logger.info("[CACHE_INVALIDATED]", { pattern, total });
  }

  return total;
};

exports.clearCache = (pattern) => (req, res, next) => {
  setImmediate(() => {
    exports.invalidateCache(pattern).catch((err) =>
      logger.warn("[CACHE_CLEAR_FAIL]", { pattern, message: err.message })
    );
  });

  return next();
};
