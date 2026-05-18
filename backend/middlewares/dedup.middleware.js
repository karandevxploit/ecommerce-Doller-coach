const crypto = require("crypto");

const redis = require("../config/redis");
const { logger } = require("../utils/logger");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP_PREFIXES = [
  "/api/uploads",
  "/api/categories",
  "/api/admin/offers",
  "/api/admin/products",
  "/uploads",
  "/api/payments/webhook",
  "/api/webhooks",
  "/api/shiprocket/webhook",
];

const stableStringify = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const getUserScope = (req) =>
  req.user?._id ||
  req.user?.id ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  "anonymous";

const shouldSkip = (req) => {
  if (process.env.NODE_ENV === "test") return true;
  if (!MUTATING_METHODS.has(req.method)) return true;

  const url = req.originalUrl || req.url || "";
  if (SKIP_PREFIXES.some((prefix) => url.startsWith(prefix))) return true;

  if (req.headers["x-idempotency-key"] || req.headers["idempotency-key"]) return true;

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) return true;

  return false;
};

const buildKey = (req) => {
  const bodyHash = crypto
    .createHash("sha256")
    .update(stableStringify(req.body || {}))
    .digest("hex");

  const route = `${req.method}:${req.baseUrl || ""}${req.path || req.originalUrl || ""}`;
  const scope = getUserScope(req);

  return `dedup:${scope}:${crypto.createHash("sha1").update(`${route}:${bodyHash}`).digest("hex")}`;
};

exports.buildDedupKey = buildKey;

exports.dedup = (ttlWindow = 1) => async (req, res, next) => {
  if (shouldSkip(req) || !redis.isReady?.()) {
    return next();
  }

  const ttl = Math.max(1, Number(ttlWindow) || 1);
  const lockKey = buildKey(req);

  try {
    const acquired = await redis.safeCall((r) => r.set(lockKey, "1", "EX", ttl, "NX"));

    if (!acquired) {
      logger.warn("[REQUEST_DEDUPLICATED]", {
        path: req.originalUrl,
        method: req.method,
        userId: req.user?._id || req.user?.id || null,
      });

      return res.status(409).json({
        success: false,
        data: null,
        message: "Request already being processed. Please wait.",
        code: "DUPLICATE_REQUEST",
      });
    }
  } catch (err) {
    logger.warn("[DEDUP_ERROR]", { message: err.message });
  }

  return next();
};
