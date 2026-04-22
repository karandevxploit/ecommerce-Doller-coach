const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");

/**
 * ENTERPRISE-GRADE REQUEST TRACKER MIDDLEWARE
 *
 * Features:
 * 1. Secure header extraction (sanitized)
 * 2. Async context propagation (AsyncLocalStorage)
 * 3. Multi-header support
 * 4. Length + charset validation
 * 5. Fail-safe UUID generation
 * 6. Global access helper (for logs/services)
 */

const asyncLocalStorage = new AsyncLocalStorage();

// Limits to prevent abuse
const MAX_ID_LENGTH = 64;

// Generate safe request ID
const generateRequestId = () => {
  try {
    return crypto.randomUUID();
  } catch (err) {
    // Fallback (never fail)
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

// Sanitize incoming request ID
const sanitizeRequestId = (id) => {
  if (!id || typeof id !== "string") return null;

  const clean = id.trim();

  if (clean.length === 0 || clean.length > MAX_ID_LENGTH) {
    return null;
  }

  // Prevent log injection / unsafe chars
  const safePattern = /^[a-zA-Z0-9\-._:]+$/;
  if (!safePattern.test(clean)) {
    return null;
  }

  return clean;
};

const requestTracker = (req, res, next) => {
  try {
    // Support multiple standard headers
    const incomingId =
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"] ||
      null;

    const requestId =
      sanitizeRequestId(incomingId) || generateRequestId();

    // Attach to request
    req.requestId = requestId;

    // Standard header casing
    res.setHeader("X-Request-ID", requestId);

    // Async context propagation
    asyncLocalStorage.run({ requestId }, () => {
      next();
    });
  } catch (err) {
    // Absolute fail-safe (never break request)
    const fallbackId = generateRequestId();

    req.requestId = fallbackId;
    res.setHeader("X-Request-ID", fallbackId);

    next();
  }
};

/**
 * Global accessor (use in logger, DB layer, services)
 */
const getRequestId = () => {
  const store = asyncLocalStorage.getStore();
  return store ? store.requestId : null;
};

module.exports = {
  requestTracker,
  getRequestId,
};