const { logger } = require("../utils/logger");

// ===============================
// HELPERS
// ===============================
const isDev = process.env.NODE_ENV === "development";

// Safe JSON (avoid circular crash)
const safeSerialize = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return { note: "Serialization failed" };
  }
};

// Normalize known errors
const normalizeError = (err) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = err.code || "INTERNAL_ERROR";

  // Mongoose CastError
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    code = "INVALID_ID";
  }

  // Validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    code = "VALIDATION_ERROR";
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate resource";
    code = "DUPLICATE";
  }

  return { statusCode, message, code };
};

// ===============================
// ERROR HANDLER
// ===============================
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const { statusCode, message, code } = normalizeError(err);

  const requestId = req.requestId || "unknown";
  const userId = req.user?.id || null;

  // ===============================
  // LOGGING (SMART)
  // ===============================
  const logPayload = {
    requestId,
    path: req.originalUrl,
    method: req.method,
    statusCode,
    userId,
    ip: req.ip,
    error: err.message,
    stack: isDev ? err.stack : undefined,
  };

  if (statusCode >= 500) {
    logger.error("[SERVER_ERROR]", safeSerialize(logPayload));
  } else {
    logger.warn("[CLIENT_ERROR]", safeSerialize(logPayload));
  }

  // ===============================
  // RESPONSE (SAFE)
  // ===============================
  const response = {
    success: false,
    code,
    message:
      statusCode >= 500 && !isDev
        ? "Something went wrong"
        : message,
  };

  if (isDev) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

// ===============================
// 404 HANDLER
// ===============================
const notFound = (req, res) => {
  return res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `Route not found: ${req.originalUrl}`,
  });
};

// ===============================
// SAFE ASYNC WRAPPER
// ===============================
const safeHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  safeHandler,
};