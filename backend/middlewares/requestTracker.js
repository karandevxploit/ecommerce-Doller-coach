const {
  asyncLocalStorage,
  generateSafeId,
  getRequestId,
  requestIdMiddleware,
  sanitizeIncomingId,
} = require("./requestId.middleware");

const requestTracker = requestIdMiddleware;
const generateRequestId = generateSafeId;
const sanitizeRequestId = sanitizeIncomingId;

module.exports = {
  requestTracker,
  requestIdMiddleware,
  getRequestId,
  asyncLocalStorage,
  generateRequestId,
  sanitizeRequestId,
};
