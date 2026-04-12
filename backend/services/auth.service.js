const jwt = require("jsonwebtoken");
const env = require("../config/env");

class AuthService {
  static generateAccessToken(user) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      type: "access"
    };
    return jwt.sign(payload, env.JWT_SECRET, { 
      expiresIn: "15m", // Reduced from 7d for security
      issuer: "ecommerce-backend",
    });
  }

  static generateRefreshToken(user) {
    const payload = {
      id: user._id,
      type: "refresh"
    };
    const secret = env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
    return jwt.sign(payload, secret, { 
      expiresIn: "7d",
      issuer: "ecommerce-backend",
    });
  }

  static verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded.type !== "access") return null;
      return decoded;
    } catch (err) {
      if (err.name !== "TokenExpiredError") {
        const logger = require("../utils/logger");
        logger.warn("JWT Verification failed:", { error: err.message });
      }
      return null;
    }
  }

  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET);
      if (decoded.type !== "refresh") return null;
      return decoded;
    } catch (err) {
      return null;
    }
  }
}

module.exports = AuthService;
