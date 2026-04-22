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

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const requestId = getRequestId?.() || "unknown";

    try {
      if (!schema) return next();

      // Validate source
      if (!["body", "query", "params"].includes(source)) {
        logger.error("Invalid validation source", {
          requestId,
          source,
        });
        return next(new Error("Invalid validation configuration"));
      }

      const dataToValidate = req[source];

      // Payload size protection
      const approxSize = JSON.stringify(dataToValidate || {}).length;
      if (approxSize > MAX_PAYLOAD_SIZE) {
        logger.warn("Payload too large for validation", {
          requestId,
          size: approxSize,
          path: req.originalUrl,
        });

        return res.status(413).json({
          success: false,
          message: "Payload too large",
        });
      }

      // Enforce strict schema if available
      const strictSchema = schema.strict ? schema.strict() : schema;

      const result = strictSchema.safeParse(dataToValidate);

      if (!result.success) {
        const details = result.error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        logger.warn("VALIDATION_FAILURE", {
          requestId,
          method: req.method,
          path: req.originalUrl,
          errors: details,
        });

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: details,
        });
      }

      // Replace with sanitized/parsed data
      req[source] = result.data;

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

module.exports = validate;