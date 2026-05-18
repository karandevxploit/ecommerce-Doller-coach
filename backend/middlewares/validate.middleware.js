const { logger } = require("../utils/logger");
const { getRequestId } = require("./requestTracker");

/**
 * ENTERPRISE VALIDATION MIDDLEWARE
 *
 * Features:
 * - Strict schema enforcement (no unknown fields)
 * - Request size guard
 * - Structured logging with requestId
 * - Safe error exposure
 * - Source validation safety
 * - Fail-safe execution
 */

const MAX_PAYLOAD_SIZE = 50 * 1024; // 50KB safe limit
const VALID_SOURCES = new Set(["body", "query", "params"]);

const safeJsonSize = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value || {}), "utf8");
  } catch (err) {
    return MAX_PAYLOAD_SIZE + 1;
  }
};

const normalizePath = (path = []) => {
  const parts = Array.isArray(path) ? path : [path];
  const clean = parts.filter((item) => item !== undefined && item !== null);
  return clean.length ? clean.join(".") : "request";
};

const formatIssues = (issues = []) => {
  const details = issues.map((err) => ({
    field: normalizePath(err.path),
    path: normalizePath(err.path),
    message: err.message || "Invalid value",
  }));

  const errors = {};
  details.forEach((item) => {
    if (!errors[item.field]) errors[item.field] = item.message;
  });

  return { details, errors };
};

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    if (res.headersSent) return undefined;

    const requestId = getRequestId?.(req) || req.requestId || "unknown";

    try {
      if (!schema) return next();

      // Validate source
      if (!VALID_SOURCES.has(source)) {
        logger.error("Invalid validation source", {
          requestId,
          source,
        });
        return next(new Error("Invalid validation configuration"));
      }

      const hasWrappedSchema =
        schema &&
        typeof schema === "object" &&
        schema.shape &&
        (schema.shape.body || schema.shape.query || schema.shape.params);

      const dataToValidate = hasWrappedSchema
        ? {
            body: req.body || {},
            query: req.query || {},
            params: req.params || {},
          }
        : (req[source] || {});

      // Payload size protection
      const approxSize = safeJsonSize(dataToValidate);
      if (approxSize > MAX_PAYLOAD_SIZE) {
        logger.warn("Payload too large for validation", {
          requestId,
          size: approxSize,
          path: req.originalUrl,
        });

        return res.status(413).json({
          success: false,
          data: null,
          code: "PAYLOAD_TOO_LARGE",
          errorCode: "PAYLOAD_TOO_LARGE",
          message: "Payload too large",
          requestId,
        });
      }

      // Enforce strict schema if available
      const strictSchema = hasWrappedSchema
        ? schema
        : (schema.strict ? schema.strict() : schema);

      const result = strictSchema.safeParse(dataToValidate);

      if (!result.success) {
        const issues = result.error.issues || result.error.errors || [];
        const { details, errors } = formatIssues(issues);

        logger.warn("VALIDATION_FAILURE", {
          requestId,
          method: req.method,
          path: req.originalUrl,
          errors: details,
        });

        return res.status(400).json({
          success: false,
          data: null,
          code: "VALIDATION_ERROR",
          errorCode: "VALIDATION_ERROR",
          message: "Validation failed",
          errors,
          details,
          requestId,
        });
      }

      // Replace with sanitized/parsed data
      if (hasWrappedSchema) {
        req.body = result.data.body || req.body;
        req.query = result.data.query || req.query;
        req.params = result.data.params || req.params;
      } else {
        req[source] = result.data;
      }

      next();
    } catch (err) {
      logger.error("VALIDATION_ERROR", {
        requestId,
        error: err.message,
        stack: err.stack,
      });

      // Never crash request
      return next(err);
    }
  };
};

validate.formatIssues = formatIssues;

module.exports = validate;
