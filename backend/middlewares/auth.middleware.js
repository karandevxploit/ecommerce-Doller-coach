const AuthService = require("../services/auth.service");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const { fail } = require("../utils/apiResponse");

exports.isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return fail(res, "Authentication required", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = AuthService.verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token", 
        data: null,
        code: "TOKEN_EXPIRED" 
      });
    }

    const user = await User.findById(decoded.id).lean();
    if (!user) {
      return fail(res, "User no longer exists", 401);
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error("Auth middleware error:", err);
    next(err);
  }
};

exports.isAdmin = (req, res, next) => {
  if (!req.user) {
    return fail(res, "Authentication required", 401);
  }

  if (req.user.role !== "admin") {
    logger.warn(`Unauthorized admin access attempt by user: ${req.user._id}`);
    return fail(res, "Access denied. Admin only.", 403);
  }

  next();
};

/**
 * Legacy support / Wrapper for existing routes
 */
exports.protect = exports.isAuthenticated;
exports.requireUser = exports.isAuthenticated;
exports.requireAdmin = [exports.isAuthenticated, exports.isAdmin];
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return fail(res, "Forbidden", 403);
  }
  next();
};
