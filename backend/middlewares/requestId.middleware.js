const { v4: uuidv4, validate: uuidValidate } = require("uuid");
const { AsyncLocalStorage } = require("async_hooks");

/**
 * ENTERPRISE-GRADE CORRELATION + CONTEXT MIDDLEWARE
 *
 * Features:
 * 1. Safe Request ID extraction (header sanitization)
 * 2. Async context propagation (AsyncLocalStorage)
 * 3. Multi-header support (x-request-id, x-correlation-id)
 * 4. Length + format validation
 * 5. Fail-safe fallback (never crashes)
 * 6. Ready for distributed tracing
 */

const asyncLocalStorage = new AsyncLocalStorage();

// Configurable limits
const MAX_ID_LENGTH = 64;

// Safe ID generator
const generateSafeId = () => {
  try {
    return uuidv4();
  } catch (err) {
    // Absolute fallback (extremely rare)
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

// Sanitize incoming ID
const sanitizeIncomingId = (id) => {
  if (!id || typeof id !== "string") return null;

  // Trim and basic cleanup
  const cleanId = id.trim();

  // Length check
  if (cleanId.length === 0 || cleanId.length > MAX_ID_LENGTH) {
    return null;
  }

  // Allow only safe characters (prevent log injection)
  const safePattern = /^[a-zA-Z0-9\-._:]+$/;
  if (!safePattern.test(cleanId)) {
    return null;
  }

  // Prefer valid UUIDs, but allow safe custom IDs
  if (uuidValidate(cleanId)) {
    return cleanId;
  }

  return cleanId;
};

const requestIdMiddleware = (req, res, next) => {
  try {
    // Extract from multiple standard headers
    const incomingId =
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"] ||
      null;

    const requestId =
      sanitizeIncomingId(incomingId) || generateSafeId();

    // Attach to request
    req.id = requestId;

    // Attach to response
    res.setHeader("X-Request-ID", requestId);

    // Async context propagation
    asyncLocalStorage.run({ requestId }, () => {
      next();
    });
  } catch (err) {
    // Absolute fail-safe (middleware must never crash)
    const fallbackId = generateSafeId();

    req.id = fallbackId;
    res.setHeader("X-Request-ID", fallbackId);

    next();
  }
};

/**
 * Helper to access requestId anywhere (logs, services, DB layer)
 */
const getRequestId = () => {
  const store = asyncLocalStorage.getStore();
  return store ? store.requestId : null;
};

module.exports = {
  requestIdMiddleware,
  getRequestId,
};