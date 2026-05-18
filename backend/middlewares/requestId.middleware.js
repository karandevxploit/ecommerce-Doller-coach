const crypto = require("crypto");
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
const SAFE_ID_PATTERN = /^[a-zA-Z0-9\-._:]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Safe ID generator
const generateSafeId = () => {
  try {
    return crypto.randomUUID();
  } catch (err) {
    // Absolute fallback (extremely rare)
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

// Sanitize incoming ID
const sanitizeIncomingId = (id) => {
  const rawId = Array.isArray(id) ? id[0] : id;
  if (!rawId || typeof rawId !== "string") return null;

  // Some proxies can join duplicate headers with commas.
  const cleanId = rawId.split(",")[0].trim();

  // Length check
  if (cleanId.length === 0 || cleanId.length > MAX_ID_LENGTH) {
    return null;
  }

  // Allow only safe characters (prevent log injection)
  if (!SAFE_ID_PATTERN.test(cleanId)) {
    return null;
  }

  // Prefer valid UUIDs, but allow safe custom IDs
  if (UUID_PATTERN.test(cleanId)) {
    return cleanId;
  }

  return cleanId;
};

const attachRequestId = (req, res, requestId) => {
  if (req) {
    req.id = requestId;
    req.requestId = requestId;
    req.correlationId = requestId;
  }

  if (res?.locals) {
    res.locals.requestId = requestId;
  }

  if (typeof res?.setHeader === "function") {
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-Correlation-ID", requestId);
  }
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

    attachRequestId(req, res, requestId);

    // Async context propagation
    asyncLocalStorage.run({ requestId, correlationId: requestId }, () => {
      next();
    });
  } catch (err) {
    // Absolute fail-safe (middleware must never crash)
    const fallbackId = generateSafeId();

    attachRequestId(req, res, fallbackId);

    next();
  }
};

/**
 * Helper to access requestId anywhere (logs, services, DB layer)
 */
const getRequestId = (req) => {
  if (req?.requestId || req?.id) {
    return req.requestId || req.id;
  }

  const store = asyncLocalStorage.getStore();
  return store ? store.requestId : null;
};

module.exports = {
  requestIdMiddleware,
  requestTracker: requestIdMiddleware,
  getRequestId,
  asyncLocalStorage,
  generateSafeId,
  sanitizeIncomingId,
};
