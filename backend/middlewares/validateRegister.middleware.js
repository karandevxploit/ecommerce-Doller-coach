const { logger } = require("../utils/logger");
const { fail } = require("../utils/apiResponse");
const { getRequestId } = require("./requestTracker");

/**
 * REGISTRATION VALIDATION MIDDLEWARE
 * Validates input BEFORE hitting controller
 */
const validateRegister = (req, res, next) => {
  try {
    if (res.headersSent) return undefined;

    const requestId = getRequestId?.(req) || req.requestId || "unknown";
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { name, email, password, phone } = body;
    const errors = {};

    const reject = (field, message, status = 400) => {
      errors[field] = message;
      logger.warn("[VALIDATE_REGISTER_FAILED]", {
        requestId,
        field,
        method: req.method,
        path: req.originalUrl,
      });
      return fail(res, message, status, errors);
    };

    // Required fields check
    if (!name || typeof name !== "string" || !name.trim()) {
      return reject("name", "Name is required and must be a string");
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return reject("email", "Email is required and must be a valid string");
    }

    if (!password || typeof password !== "string") {
      return reject("password", "Password is required");
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return reject("email", "Please provide a valid email address");
    }

    // Password length check
    if (password.length < 8) {
      return reject("password", "Password must be at least 8 characters long");
    }

    if (password.length > 128) {
      return reject("password", "Password must be less than 128 characters");
    }

    // Name length check
    if (name.trim().length < 2) {
      return reject("name", "Name must be at least 2 characters long");
    }

    if (name.trim().length > 100) {
      return reject("name", "Name must be less than 100 characters");
    }

    // Phone validation (optional, but must be valid when provided)
    const cleanPhone = phone === undefined || phone === null ? "" : String(phone).trim();
    if (cleanPhone && !/^[0-9+\-\s()]+$/.test(cleanPhone)) {
      return reject("phone", "A valid phone number is required");
    }
    if (cleanPhone && (cleanPhone.length < 7 || cleanPhone.length > 20)) {
      return reject("phone", "Phone must be between 7 and 20 characters");
    }

    // Sanitize input (remove dangerous characters/trim whitespace)
    req.body.name = name.trim();
    req.body.email = email.toLowerCase().trim();
    req.body.password = password; // Don't trim password - user might want spaces
    if (cleanPhone) req.body.phone = cleanPhone;

    // Prevent NoSQL injection by removing dangerous patterns
    const dangerousPatterns = [/\$[a-z]+/i]; // $where, $regex, etc.
    const checkField = (field) => {
      if (typeof field === "string") {
        return dangerousPatterns.some(pattern => pattern.test(field));
      }
      return false;
    };

    if (checkField(req.body.name) || checkField(req.body.email)) {
      return reject("request", "Invalid input detected");
    }

    next();
  } catch (err) {
    logger.error("[VALIDATE_REGISTER_MIDDLEWARE_ERROR]", {
      message: err.message,
      stack: err.stack,
    });
    return fail(res, "Validation error", 500);
  }
};

module.exports = validateRegister;
