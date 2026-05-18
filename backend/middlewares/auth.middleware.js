const asyncHandler = require("express-async-handler");

const AuthService = require("../services/auth.service");
const User = require("../models/user.model");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");
const AppError = require("../utils/AppError");

const AUTH_CACHE_TTL = Number(process.env.AUTH_CACHE_TTL_SECONDS || 60);
const localAuthCache = new Map();

const authError = (message = "Authentication required", status = 401) =>
  new AppError(message, status);

const normalizeRole = (role = "user") => String(role || "user").toLowerCase();

const extractToken = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const bearer = AuthService.extractBearerToken(authHeader);
  if (bearer) return bearer;

  return (
    req.cookies?.accessToken ||
    req.cookies?.token ||
    req.cookies?.authToken ||
    req.query?.accessToken ||
    null
  );
};

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const getCachedUserState = async (userId) => {
  const key = `auth:user:${userId}`;
  const now = Date.now();
  const local = localAuthCache.get(key);

  if (local && local.expiresAt > now) return local.value;
  if (local) localAuthCache.delete(key);

  const redisValue = safeJsonParse(await safeCall((r) => r.get(key)));
  if (redisValue) {
    localAuthCache.set(key, {
      value: redisValue,
      expiresAt: now + AUTH_CACHE_TTL * 1000,
    });
    return redisValue;
  }

  const user = await User.findOne({ _id: userId })
    .select("_id role tokenVersion isDeleted")
    .lean();

  if (!user) return null;

  const value = {
    id: String(user._id),
    role: normalizeRole(user.role),
    tokenVersion: Number(user.tokenVersion || 0),
    isDeleted: Boolean(user.isDeleted),
  };

  localAuthCache.set(key, {
    value,
    expiresAt: now + AUTH_CACHE_TTL * 1000,
  });

  safeCall((r) => r.set(key, JSON.stringify(value), "EX", AUTH_CACHE_TTL));

  return value;
};

const attachUser = (req, decoded, userState) => {
  const userId = String(decoded.sub || decoded.id || userState.id);

  req.user = {
    ...decoded,
    id: userId,
    _id: userId,
    userId,
    role: userState.role,
    tokenVersion: userState.tokenVersion,
  };
};

// ===============================
// AUTHENTICATION MIDDLEWARE
// ===============================
const isAuthenticated = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(authError("No token provided", 401));
  }

  const verification = AuthService.verifyAccessToken(token);

  if (!verification.valid) {
    return next(authError("Invalid or expired token", 401));
  }

  const decoded = verification.data || {};
  const userId = decoded.sub || decoded.id;

  if (!userId) {
    return next(authError("Invalid token payload", 401));
  }

  const userState = await getCachedUserState(userId);

  if (!userState || userState.isDeleted) {
    return next(authError("User account not found", 401));
  }

  if (Number(decoded.tokenVersion || 0) !== Number(userState.tokenVersion || 0)) {
    return next(authError("Session expired. Please login again", 401));
  }

  attachUser(req, decoded, userState);
  return next();
});

// ===============================
// ADMIN CHECK
// ===============================
const isAdmin = (req, _res, next) => {
  if (!req.user || normalizeRole(req.user.role) !== "admin") {
    logger.warn("[AUTH_ADMIN_DENIED]", {
      ip: req.ip,
      userId: req.user?.id || null,
    });

    return next(authError("Admin access required", 403));
  }

  return next();
};

// ===============================
// ROLE-BASED AUTHORIZATION
// ===============================
const authorize = (...roles) => (req, _res, next) => {
  const normalizedRoles = roles.flat().map(normalizeRole);
  const currentRole = normalizeRole(req.user?.role);

  if (!req.user || !normalizedRoles.includes(currentRole)) {
    logger.warn("[AUTH_ROLE_DENIED]", {
      userId: req.user?.id || null,
      role: currentRole,
      required: normalizedRoles,
    });

    return next(authError("Access forbidden", 403));
  }

  return next();
};

exports.extractToken = extractToken;
exports.isAuthenticated = isAuthenticated;
exports.protect = isAuthenticated;
exports.isAdmin = isAdmin;
exports.authorize = authorize;
exports.requireAdmin = [isAuthenticated, isAdmin];
exports.clearAuthCache = async (userId) => {
  if (!userId) return;
  const key = `auth:user:${userId}`;
  localAuthCache.delete(key);
  await safeCall((r) => r.del(key));
};
