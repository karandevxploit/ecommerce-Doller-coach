const AuthService = require("../services/auth.service");
const { logger } = require("../utils/logger");
const AppError = require("../utils/AppError");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");

// ===============================
// HELPER: EXTRACT TOKEN
// ===============================
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
};

// ===============================
// HELPER: REQUEST ID
// ===============================
const getRequestId = (req) => {
  return req.headers["x-request-id"] || crypto.randomUUID();
};

// ===============================
// AUTHENTICATION MIDDLEWARE
// ===============================
exports.isAuthenticated = asyncHandler(async (req, res, next) => {
  const requestId = getRequestId(req);
  req.requestId = requestId;

  const token = extractToken(req);

  if (!token) {
    logger.warn("[AUTH_NO_TOKEN]", { requestId, ip: req.ip });
    return next(new AppError("Authentication required", 401));
  }

  try {
    const result = AuthService.verifyAccessToken(token);

    if (!result.valid) {
      logger.warn("[AUTH_INVALID_TOKEN]", { requestId, reason: result.reason });
      return next(new AppError("Invalid or expired session", 401));
    }

    const decoded = result.data;

    // Normalize role
    const role = String(decoded.role || "user").toLowerCase();

    req.user = {
      id: decoded.id,
      role,
      email: decoded.email || null,
    };

    logger.debug("[AUTH_SUCCESS]", {
      requestId,
      userId: decoded.id,
      role,
    });

    next();
  } catch (err) {
    logger.error("[AUTH_ERROR]", {
      requestId,
      message: err.message,
      name: err.name,
    });

    return next(new AppError("Invalid or expired session", 401));
  }
});

// ===============================
// ADMIN CHECK
// ===============================
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    logger.warn("[AUTH_ADMIN_DENIED]", {
      ip: req.ip,
      userId: req.user?.id || null,
    });

    return next(new AppError("Admin access required", 403));
  }
  next();
};

// ===============================
// ROLE-BASED AUTHORIZATION
// ===============================
exports.authorize = (...roles) => (req, res, next) => {
  const normalizedRoles = roles.map((r) => String(r).toLowerCase());

  if (!req.user || !normalizedRoles.includes(req.user.role)) {
    logger.warn("[AUTH_ROLE_DENIED]", {
      userId: req.user?.id,
      role: req.user?.role,
      required: normalizedRoles,
    });

    return next(new AppError("Access forbidden", 403));
  }

  next();
};

// ===============================
// SHORTCUT EXPORTS
// ===============================
exports.protect = exports.isAuthenticated;
exports.requireAdmin = [exports.isAuthenticated, exports.isAdmin];