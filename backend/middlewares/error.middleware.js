const { logger } = require("../utils/logger");

const isDev = process.env.NODE_ENV === "development";

const safeSerialize = (err = {}) => ({
  name: err.name,
  message: err.message,
  code: err.code,
  statusCode: err.statusCode,
  stack: isDev ? err.stack : undefined,
});

const validationMessages = (err) => {
  if (Array.isArray(err.issues)) {
    return err.issues.map((item) => `${item.path?.join(".") || "field"}: ${item.message}`);
  }

  if (err.errors && typeof err.errors === "object") {
    return Object.values(err.errors).map((item) => item.message || String(item));
  }

  if (Array.isArray(err.details)) {
    return err.details.map((item) => item.message || String(item));
  }

  return [];
};

const duplicateMessage = (err) => {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  if (!fields.length) return "Duplicate resource";
  return `${fields.join(", ")} already exists`;
};

const normalizeError = (err = {}) => {
  let statusCode = Number(err.statusCode || err.status || 500);
  let code = err.code || "INTERNAL_ERROR";
  let message = err.message || "Internal server error";
  let errors = null;

  if (statusCode < 400 || statusCode > 599) statusCode = 500;

  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = "Invalid ID format";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    errors = validationMessages(err);
    message = errors[0] || "Validation failed";
  } else if (err.name === "ZodError" || err.issues) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    errors = validationMessages(err);
    message = errors[0] || "Validation failed";
  } else if (Array.isArray(err.details)) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    errors = validationMessages(err);
    message = errors[0] || "Validation failed";
  } else if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_RESOURCE";
    message = duplicateMessage(err);
  } else if (err.name === "MulterError") {
    statusCode = 400;
    code = "UPLOAD_ERROR";
    message = err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : err.message || "Invalid upload request";
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "AUTH_TOKEN_INVALID";
    message = "Invalid or expired token";
  } else if (err.name === "SyntaxError" && "body" in err) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Invalid JSON payload";
  } else if (String(err.message || "").toLowerCase().includes("invalid file type")) {
    statusCode = 400;
    code = "INVALID_FILE_TYPE";
    message = "Invalid file type";
  }

  if (statusCode >= 500 && !isDev) {
    message = "Internal server error";
  }

  return { statusCode, message, code, errors };
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const normalized = normalizeError(err);
  const requestId = req.requestId || req.headers?.["x-request-id"] || null;
  const logPayload = {
    ...safeSerialize(err),
    requestId,
    path: req.originalUrl,
    method: req.method,
    code: normalized.code,
    statusCode: normalized.statusCode,
    userId: req.user?._id || req.user?.id || null,
  };

  if (normalized.statusCode >= 500) {
    logger.error(logPayload, "[API_ERROR]");
  } else {
    logger.warn(logPayload, "[API_WARN]");
  }

  return res.status(normalized.statusCode).json({
    success: false,
    data: null,
    message: normalized.message,
    code: normalized.code,
    errorCode: normalized.code,
    ...(requestId ? { requestId } : {}),
    ...(normalized.errors ? { errors: normalized.errors } : {}),
  });
};

const notFound = (req, res) => {
  return res.status(404).json({
    success: false,
    data: null,
    code: "NOT_FOUND",
    errorCode: "NOT_FOUND",
    message: `Route not found: ${req.originalUrl}`,
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
};

const safeHandler = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res, next);

    return Promise.resolve(result)
      .then((value) => {
        if (res.headersSent || value === undefined || value === null) return undefined;
        if (typeof value === "object") {
          return res.json({ success: true, data: value, message: "" });
        }
        return value;
      })
      .catch(next);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  errorHandler,
  notFound,
  normalizeError,
  safeHandler,
};
