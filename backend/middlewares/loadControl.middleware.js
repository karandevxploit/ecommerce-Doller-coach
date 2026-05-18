const { logger } = require("../utils/logger");

const BASE_LAG_THRESHOLD = Number(process.env.LOAD_LAG_THRESHOLD_MS || 300);
const BASE_REQ_THRESHOLD = Number(process.env.LOAD_ACTIVE_REQUEST_LIMIT || 800);
const COOLDOWN_RETRY_AFTER = Number(process.env.LOAD_RETRY_AFTER_SECONDS || 2);

let dynamicLagThreshold = BASE_LAG_THRESHOLD;
let dynamicReqThreshold = BASE_REQ_THRESHOLD;
let eventLoopLag = 0;
let activeRequests = 0;
let shedCount = 0;
let timeoutCount = 0;

const SKIP_PATHS = ["/health", "/metrics", "/warmup"];
const SKIP_PREFIXES = ["/uploads", "/api/uploads", "/api/payments/webhook", "/api/webhooks"];

const shouldSkipControl = (req) => {
  const path = req.path || req.originalUrl || "";
  return SKIP_PATHS.includes(path) || SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
};

const monitorEventLoop = () => {
  let last = process.hrtime.bigint();

  setInterval(() => {
    const now = process.hrtime.bigint();
    const deltaMs = Number(now - last) / 1e6;
    eventLoopLag = Math.max(0, deltaMs - 1000);
    last = now;
  }, 1000).unref();
};

const tuneThresholds = () => {
  setInterval(() => {
    if (eventLoopLag > BASE_LAG_THRESHOLD) {
      dynamicLagThreshold = Math.max(100, dynamicLagThreshold - 25);
      dynamicReqThreshold = Math.max(200, dynamicReqThreshold - 50);
      return;
    }

    dynamicLagThreshold = Math.min(BASE_LAG_THRESHOLD * 2, dynamicLagThreshold + 10);
    dynamicReqThreshold = Math.min(BASE_REQ_THRESHOLD, dynamicReqThreshold + 25);
  }, 30000).unref();
};

monitorEventLoop();
tuneThresholds();

const requestCounter = (req, res, next) => {
  activeRequests += 1;

  let done = false;
  const dec = () => {
    if (done) return;
    done = true;
    activeRequests = Math.max(0, activeRequests - 1);
  };

  res.once("finish", dec);
  res.once("close", dec);

  return next();
};

const timeoutMiddleware = (ms = 15000) => (req, res, next) => {
  const accept = String(req.headers.accept || "");
  const isStreaming =
    accept.includes("text/event-stream") ||
    req.headers["x-no-timeout"] === "1" ||
    shouldSkipControl(req);

  if (isStreaming) return next();

  const timer = setTimeout(() => {
    req.timedOut = true;
    timeoutCount += 1;

    if (!res.headersSent) {
      logger.warn("[TIMEOUT]", {
        method: req.method,
        url: req.originalUrl,
        ms,
        activeRequests,
      });

      res.setHeader("Retry-After", "1");
      return res.status(504).json({
        success: false,
        data: null,
        code: "TIMEOUT",
        errorCode: "TIMEOUT",
        message: "Request timed out",
      });
    }
  }, ms);

  const clear = () => clearTimeout(timer);
  res.once("finish", clear);
  res.once("close", clear);

  return next();
};

const loadShedder = (req, res, next) => {
  if (shouldSkipControl(req)) return next();

  const overloaded =
    activeRequests > dynamicReqThreshold ||
    (eventLoopLag > dynamicLagThreshold && activeRequests > Math.floor(dynamicReqThreshold * 0.5));

  if (!overloaded) return next();

  shedCount += 1;

  logger.error("[LOAD_SHED]", {
    lag: eventLoopLag,
    activeRequests,
    path: req.originalUrl,
    dynamicLagThreshold,
    dynamicReqThreshold,
  });

  res.setHeader("Retry-After", String(COOLDOWN_RETRY_AFTER));
  res.setHeader("X-Load-Shed", "1");

  return res.status(503).json({
    success: false,
    data: null,
    code: "SERVER_BUSY",
    errorCode: "SERVER_BUSY",
    message: "Server under load, please retry shortly",
  });
};

const getLoadStats = () => ({
  eventLoopLag,
  activeRequests,
  dynamicLagThreshold,
  dynamicReqThreshold,
  shedCount,
  timeoutCount,
});

module.exports = {
  requestCounter,
  timeoutMiddleware,
  loadShedder,
  getLoadStats,
};
