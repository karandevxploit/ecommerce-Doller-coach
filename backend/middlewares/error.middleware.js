const logger = require("../utils/logger");
const env = require("../config/env");

function notFound(req, res) {
  logger.warn(`Route not found: ${req.originalUrl}`);
  res.status(404).json({ success: false, data: null, message: "Route not found" });
}

function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorCode = err.errorCode || "INTERNAL_ERROR";
  let errors = err.errors || undefined;

  // 1. Classification & Normalization
  const isZod = err && (err.name === "ZodError" || err.constructor?.name === "ZodError");
  const isMongoose = err && (err.name === "ValidationError" || err.name === "CastError");

  if (isZod || err.errorCode === "VALIDATION_FAILED") {
    status = 400;
    errorCode = "VALIDATION_FAILED";
    message = "Validation failed for the requested resource.";
  } else if (isMongoose) {
    status = 400;
    errorCode = "DATA_VALIDATION_ERROR";
    if (err.name === "ValidationError") {
      message = Object.values(err.errors).map(val => val.message).join(", ");
    }
  } else if (err.code === 11000) {
    status = 409;
    errorCode = "DUPLICATE_ENTRY";
    message = "Data provided already exists.";
  }

  // 2. Logging with Context
  const logMethod = status >= 500 ? "error" : "warn";
  const requestId = req.requestId || "no-trace";

  logger[logMethod](`${req.method} ${req.originalUrl} - [${requestId}] - ${status} - ${errorCode} - ${message}`, {
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
    user: req.user ? req.user._id : "anonymous",
    isOperational: err.isOperational || false,
    requestId,
  });

  // 3. Mask Internal Errors in Production
  if (status === 500 && env.NODE_ENV === "production" && !err.isOperational) {
    message = "A system error occurred. Our engineers are notified.";
    errorCode = "INTERNAL_SERVER_ERROR";
  }

  // 4. Response Delivery
  res.status(status).json({
    success: false,
    message,
    errorCode,
    errors,
    requestId: (env.NODE_ENV === "development" || status >= 500) ? requestId : undefined,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
}

module.exports = { notFound, errorHandler };

