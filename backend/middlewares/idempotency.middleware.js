const redis = require("../config/redis");
const { isRedisReady } = require("../config/redis");
const { logger } = require("../utils/logger");
const crypto = require("crypto");

// ===============================
// CONFIG
// ===============================
const PENDING_TTL = 120;
const CACHE_TTL = 600;
const MAX_BODY_SIZE = 200 * 1024; // 200KB

// ===============================
// HELPER: HASH REQUEST
// ===============================
const hashRequest = (req) => {
  const raw = JSON.stringify({
    body: req.body,
    query: req.query,
    path: req.path
  });
  return crypto.createHash("sha256").update(raw).digest("hex");
};

// ===============================
// MIDDLEWARE
// ===============================
const idempotency = async (req, res, next) => {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();

  const keyHeader =
    req.headers["x-idempotency-key"] ||
    req.headers["idempotency-key"];

  if (!keyHeader) return next();

  if (!isRedisReady()) {
    logger.warn("[IDEMPOTENCY_BYPASS] Redis not ready");
    return next();
  }

  const userId = req.user?._id || "guest";

  // 🔐 USER-SCOPED KEY (IMPORTANT FIX)
  const redisKey = `idem:${userId}:${keyHeader}`;

  const requestHash = hashRequest(req);

  try {
    const cached = await redis.get(redisKey);

    if (cached) {
      if (cached === "pending") {
        return res.status(425).json({
          success: false,
          message: "Request already in progress",
          code: "IN_FLIGHT"
        });
      }

      const parsed = JSON.parse(cached);

      // 🔐 HASH VALIDATION
      if (parsed.hash !== requestHash) {
        return res.status(409).json({
          success: false,
          message: "Idempotency key reuse with different payload",
          code: "KEY_CONFLICT"
        });
      }

      logger.info("[IDEMPOTENCY_HIT]", { key: redisKey });

      res.setHeader("X-Idempotency-Cache", "HIT");

      return res.status(parsed.statusCode).send(parsed.body);
    }

    // ===============================
    // ATOMIC LOCK (SET NX)
    // ===============================
    const lock = await redis.set(redisKey, "pending", "NX", "EX", PENDING_TTL);

    if (!lock) {
      return res.status(425).json({
        success: false,
        message: "Request already being processed",
        code: "LOCKED"
      });
    }

    // ===============================
    // INTERCEPT RESPONSE
    // ===============================
    const originalSend = res.send;

    res.send = function (body) {
      res.send = originalSend;

      try {
        if (res.statusCode < 500) {
          const bodyStr =
            typeof body === "string"
              ? body
              : JSON.stringify(body);

          if (bodyStr.length < MAX_BODY_SIZE) {
            const cachePayload = JSON.stringify({
              statusCode: res.statusCode,
              body,
              hash: requestHash
            });

            redis.set(redisKey, cachePayload, "EX", CACHE_TTL)
              .catch((e) => logger.error("[IDEMPOTENCY_CACHE_FAIL]", e.message));
          }
        } else {
          redis.del(redisKey).catch(() => { });
        }
      } catch (err) {
        logger.error("[IDEMPOTENCY_WRITE_ERROR]", err.message);
      }

      return originalSend.call(this, body);
    };

    next();

  } catch (err) {
    logger.error("[IDEMPOTENCY_ERROR]", err.message);
    next();
  }
};

module.exports = idempotency;