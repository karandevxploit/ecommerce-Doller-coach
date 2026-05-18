const { logger } = require("../utils/logger");
const metricsService = require("../services/metrics.service");

const SLOW_API_MS = Number(process.env.SLOW_API_MS || 500);
const REQUEST_LOG_SAMPLE_RATE = Math.max(
  0,
  Math.min(1, Number(process.env.REQUEST_LOG_SAMPLE_RATE ?? 0.02))
);

const SKIP_PATHS = new Set(["/health", "/metrics", "/favicon.ico"]);

const shouldSkip = (req) => SKIP_PATHS.has(req.path || req.originalUrl || "");

const shouldSample = () => REQUEST_LOG_SAMPLE_RATE >= 1 || Math.random() < REQUEST_LOG_SAMPLE_RATE;

const sanitizeUrl = (url = "") =>
  String(url || "")
    .slice(0, 300)
    .replace(/([?&](token|accessToken|refreshToken|password|otp|secret|signature)=)[^&]+/gi, "$1[redacted]");

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

const metricsMiddleware = (req, res, next) => {
  if (shouldSkip(req)) return next();

  const start = process.hrtime.bigint();
  const startedAt = new Date().toISOString();
  let recorded = false;

  const record = () => {
    if (recorded) return;
    recorded = true;

    const ms = Number((process.hrtime.bigint() - start) / 1000000n);
    const status = res.statusCode;
    const requestId = req.requestId || req.headers["x-request-id"] || req.id || "unknown";
    const userId = req.user?._id || req.user?.id || null;
    const endpoint = sanitizeUrl(req.originalUrl || req.url);

    metricsService.recordRequest({
      statusCode: status,
      latencyMs: ms,
    });

    const payload = {
      type: "request_log",
      timestamp: startedAt,
      requestId,
      userId,
      method: req.method,
      endpoint,
      statusCode: status,
      latencyMs: ms,
      ip: getIp(req),
    };

    if (status >= 500) {
      logger.error(payload, "HTTP_REQUEST_ERROR");
      return;
    }

    if (ms > SLOW_API_MS) {
      logger.warn(payload, "SLOW_API");
      return;
    }

    if (shouldSample()) {
      logger.info(payload, "HTTP_REQUEST");
    }
  };

  res.once("finish", record);
  res.once("close", record);

  return next();
};

module.exports = metricsMiddleware;
