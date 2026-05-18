const crypto = require("crypto");

const redis = require("../config/redis");
const { logger } = require("../utils/logger");

const PENDING_TTL = Number(process.env.IDEMPOTENCY_PENDING_TTL_SECONDS || 120);
const CACHE_TTL = Number(process.env.IDEMPOTENCY_CACHE_TTL_SECONDS || 600);
const MAX_BODY_SIZE = Number(process.env.IDEMPOTENCY_MAX_BODY_BYTES || 200 * 1024);
const METHODS = new Set(["POST", "PUT", "PATCH"]);

const stableStringify = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const hashRequest = (req) => {
  const raw = stableStringify({
    body: req.body || {},
    query: req.query || {},
    path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
  });

  return crypto.createHash("sha256").update(raw).digest("hex");
};

const normalizeKey = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 120);

const getUserScope = (req) => req.user?._id || req.user?.id || req.user?.userId || "guest";

const buildRedisKey = (req, keyHeader) => {
  const route = `${req.method}:${req.baseUrl || ""}${req.path || ""}`;
  const raw = `${getUserScope(req)}:${route}:${normalizeKey(keyHeader)}`;
  return `idem:${crypto.createHash("sha256").update(raw).digest("hex")}`;
};

const readCache = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const sendCached = (res, cached) => {
  res.setHeader("X-Idempotency-Cache", "HIT");
  return res.status(cached.statusCode || 200).send(cached.body);
};

const idempotency = async (req, res, next) => {
  if (!METHODS.has(req.method)) return next();

  const keyHeader = req.headers["x-idempotency-key"] || req.headers["idempotency-key"];
  const safeKey = normalizeKey(keyHeader);

  if (!safeKey) return next();
  if (!redis.isReady?.()) {
    logger.warn("[IDEMPOTENCY_BYPASS]", { reason: "redis_not_ready", path: req.originalUrl });
    return next();
  }

  const redisKey = buildRedisKey(req, safeKey);
  const requestHash = hashRequest(req);

  try {
    const cachedRaw = await redis.get(redisKey);
    const cached = readCache(cachedRaw);

    if (cachedRaw === "pending" || cached?.state === "pending") {
      res.setHeader("Retry-After", "2");
      return res.status(425).json({
        success: false,
        data: null,
        message: "Request already in progress",
        code: "IN_FLIGHT",
        errorCode: "IN_FLIGHT",
      });
    }

    if (cached) {
      if (cached.hash !== requestHash) {
        return res.status(409).json({
          success: false,
          data: null,
          message: "Idempotency key reused with a different payload",
          code: "KEY_CONFLICT",
          errorCode: "KEY_CONFLICT",
        });
      }

      logger.info("[IDEMPOTENCY_HIT]", { key: redisKey });
      return sendCached(res, cached);
    }

    const lockPayload = JSON.stringify({ state: "pending", hash: requestHash });
    const lock = await redis.safeCall((r) => r.set(redisKey, lockPayload, "EX", PENDING_TTL, "NX"));

    if (!lock) {
      res.setHeader("Retry-After", "2");
      return res.status(425).json({
        success: false,
        data: null,
        message: "Request already being processed",
        code: "LOCKED",
        errorCode: "LOCKED",
      });
    }

    res.setHeader("X-Idempotency-Cache", "MISS");

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      res.send = originalSend;

      try {
        const bodyString = typeof body === "string" || Buffer.isBuffer(body)
          ? body.toString()
          : JSON.stringify(body);

        if (res.statusCode < 500 && Buffer.byteLength(bodyString || "", "utf8") <= MAX_BODY_SIZE) {
          const payload = JSON.stringify({
            statusCode: res.statusCode,
            headers: {
              "content-type": res.getHeader("content-type") || "application/json; charset=utf-8",
            },
            body,
            hash: requestHash,
          });

          redis.safeCall((r) => r.set(redisKey, payload, "EX", CACHE_TTL)).catch((err) => {
            logger.warn("[IDEMPOTENCY_CACHE_FAIL]", { message: err.message });
          });
        } else {
          redis.del(redisKey).catch(() => {});
        }
      } catch (err) {
        logger.warn("[IDEMPOTENCY_WRITE_ERROR]", { message: err.message });
        redis.del(redisKey).catch(() => {});
      }

      return originalSend(body);
    };

    return next();
  } catch (err) {
    logger.warn("[IDEMPOTENCY_ERROR]", { message: err.message });
    return next();
  }
};

idempotency.hashRequest = hashRequest;
idempotency.buildRedisKey = buildRedisKey;

module.exports = idempotency;
