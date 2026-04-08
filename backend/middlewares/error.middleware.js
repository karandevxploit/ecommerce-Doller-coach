const logger = require("../utils/logger");
const env = require("../config/env");

function notFound(req, res) {
  logger.warn(`Route not found: ${req.originalUrl}`);
  res.status(404).json({ success: false, data: null, message: "Route not found" });
}

function errorHandler(err, req, res, _next) {
  const isZod = err && (err.name === "ZodError" || err.constructor?.name === "ZodError");
  const isMongoose = err && (err.name === "ValidationError" || err.name === "CastError");
  
  let status = err?.statusCode || 500;
  let message = err?.message || "Internal Server Error";

  if (err?.code === 11000) {
    status = 409;
    message = "Duplicate value provided for a unique field (e.g., email or phone)";
  } else if (isZod) {
    status = 400;
    message = "Invalid request data";
    // Optional: include zod issues in dev
    if (env.NODE_ENV === "development") {
      message = err.errors;
    }
  } else if (isMongoose) {
    status = 400;
    if (err.name === "ValidationError") {
      message = Object.values(err.errors).map(val => val.message).join(", ");
    } else {
      message = err.message || "Database validation failed";
    }
  }

  const logMethod = status >= 500 ? "error" : "warn";
  logger[logMethod](`${req.method} ${req.originalUrl} - ${status} - ${message}`, {
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user ? req.user._id : "anonymous",
  });

  // Mask 500 errors in production
  if (status === 500 && env.NODE_ENV === "production") {
    message = "Something went wrong. Please try again later.";
  }

  res.status(status).json({
    success: false,
    message: message,
    data: null,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
  });
}

module.exports = { notFound, errorHandler };

