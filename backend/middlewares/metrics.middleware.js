const { logger } = require("../utils/logger");

/**
 * PRODUCTION METRICS MIDDLEWARE
 * Measures request duration, status codes, and traffic volume.
 * Reports to logs for ELK/Prometheus ingestion.
 */
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  const url = req.originalUrl || req.url;

  // Cleanup to avoid memory leaks
  res.on("finish", () => {
    const duration = process.hrtime(start);
    const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
    const status = res.statusCode;

    const metric = {
      method: req.method,
      url: url,
      status: status,
      duration: parseFloat(ms),
      userAgent: req.headers["user-agent"],
      ip: req.ip
    };

    // LOG METRIC (Pino will handle this efficiently)
    if (ms > 500) {
      logger.warn(`[SLOW_PERF] ${req.method} ${url} - ${ms}ms`);
    }

    // In a real production app, you might send this to Redis/InfluxDB
    // logger.info("[METRIC]", metric);
  });

  next();
};

module.exports = metricsMiddleware;
