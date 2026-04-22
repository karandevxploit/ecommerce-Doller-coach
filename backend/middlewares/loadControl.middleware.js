const { logger } = require("../utils/logger");

// ===============================
// CONFIG
// ===============================
const BASE_LAG_THRESHOLD = 200;       // ms
const BASE_REQ_THRESHOLD = 300;       // per worker
const COOLDOWN_RETRY_AFTER = 2;       // seconds

// adaptive factors
let dynamicLagThreshold = BASE_LAG_THRESHOLD;
let dynamicReqThreshold = BASE_REQ_THRESHOLD;

// ===============================
// STATE
// ===============================
let eventLoopLag = 0;
let activeRequests = 0;

// ===============================
// EVENT LOOP MONITOR (higher fidelity)
// ===============================
let last = process.hrtime.bigint();
setInterval(() => {
  const now = process.hrtime.bigint();
  const deltaMs = Number(now - last) / 1e6;
  // expected ~1000ms interval → extra = lag
  eventLoopLag = Math.max(0, deltaMs - 1000);
  last = now;
}, 1000).unref();

// ===============================
// ADAPTIVE TUNER (every 30s)
// ===============================
setInterval(() => {
  // simple heuristic: if lag frequently high → tighten
  if (eventLoopLag > BASE_LAG_THRESHOLD) {
    dynamicLagThreshold = Math.max(100, dynamicLagThreshold - 20);
    dynamicReqThreshold = Math.max(100, dynamicReqThreshold - 20);
  } else {
    dynamicLagThreshold = Math.min(300, dynamicLagThreshold + 10);
    dynamicReqThreshold = Math.min(500, dynamicReqThreshold + 10);
  }

  logger.info("[LOAD_TUNE]", {
    lag: eventLoopLag,
    activeRequests,
    dynamicLagThreshold,
    dynamicReqThreshold
  });
}, 30000).unref();

// ===============================
// REQUEST COUNTER (double-decrement safe)
// ===============================
const requestCounter = (req, res, next) => {
  activeRequests++;

  let decremented = false;
  const dec = () => {
    if (!decremented) {
      activeRequests = Math.max(0, activeRequests - 1);
      decremented = true;
    }
  };

  res.on("finish", dec);
  res.on("close", dec);

  next();
};

// ===============================
// GLOBAL TIMEOUT (stream-aware)
// ===============================
const timeoutMiddleware = (ms = 5000) => (req, res, next) => {
  // skip long-lived endpoints (SSE, downloads)
  const isStreaming =
    req.headers.accept === "text/event-stream" ||
    req.headers["x-no-timeout"] === "1";

  if (isStreaming) return next();

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn("[TIMEOUT]", {
        method: req.method,
        url: req.originalUrl,
        ms
      });

      res.setHeader("Retry-After", "1");
      res.status(504).json({
        success: false,
        code: "TIMEOUT",
        message: "Request timed out"
      });
    }
  }, ms);

  const clear = () => clearTimeout(timer);
  res.on("finish", clear);
  res.on("close", clear);

  next();
};

// ===============================
// LOAD SHEDDER (adaptive + route aware)
// ===============================
const SKIP_PATHS = ["/health", "/metrics"];

const loadShedder = (req, res, next) => {
  if (SKIP_PATHS.includes(req.path)) return next();

  const overloaded =
    eventLoopLag > dynamicLagThreshold ||
    activeRequests > dynamicReqThreshold;

  if (overloaded) {
    logger.error("[LOAD_SHED]", {
      lag: eventLoopLag,
      activeRequests,
      path: req.originalUrl
    });

    res.setHeader("Retry-After", String(COOLDOWN_RETRY_AFTER));
    res.setHeader("X-Load-Shed", "1");

    return res.status(503).json({
      success: false,
      code: "SERVER_BUSY",
      message: "Server under load, please retry shortly"
    });
  }

  next();
};

// ===============================
// EXPORTS
// ===============================
module.exports = {
  requestCounter,
  timeoutMiddleware,
  loadShedder
};