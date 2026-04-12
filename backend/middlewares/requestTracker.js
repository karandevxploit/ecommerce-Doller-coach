const crypto = require("crypto");

/**
 * Middleware to inject a unique requestId into every request.
 * Useful for log correlation.
 */
const requestTracker = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};

module.exports = requestTracker;
