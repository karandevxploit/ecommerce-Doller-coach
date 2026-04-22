const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const RefreshToken = require("../models/refreshToken.model");

class AuthService {
  static ACCESS_EXPIRY = "15m";
  static REFRESH_EXPIRY = "7d";

  // =========================
  // 🔐 ACCESS TOKEN
  // =========================
  static generateAccessToken(user) {
    if (!user || !user._id) {
      throw new Error("Invalid user");
    }

    return jwt.sign(
      {
        id: user._id.toString(),
        sub: user._id.toString(),
        email: user.email,
        role: user.role || "user",
        tokenVersion: user.tokenVersion || 0,
        type: "access"
      },
      env.JWT_SECRET,
      {
        expiresIn: this.ACCESS_EXPIRY,
        issuer: "doller-coach-api",
        audience: "doller-coach-client"
      }
    );
  }

  // =========================
  // 🔐 REFRESH TOKEN (WITH DB)
  // =========================
  static async generateRefreshToken(user) {
    if (!user || !user._id) {
      throw new Error("Invalid user");
    }

    const jti = crypto.randomBytes(32).toString("hex");

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        jti,
        type: "refresh"
      },
      env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: this.REFRESH_EXPIRY,
        issuer: "doller-coach-api",
        audience: "doller-coach-client"
      }
    );

    await RefreshToken.create({
      userId: user._id,
      jti,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return token;
  }

  // =========================
  // 🔍 VERIFY ACCESS TOKEN
  // =========================
  static verifyAccessToken(token) {
    if (!token) return { valid: false, reason: "NO_TOKEN" };

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        issuer: "doller-coach-api",
        audience: "doller-coach-client"
      });

      if (decoded.type !== "access") {
        return { valid: false, reason: "INVALID_TYPE" };
      }

      return { valid: true, data: decoded };
    } catch (err) {
      return { valid: false, reason: err.name };
    }
  }

  // =========================
  // 🔍 VERIFY REFRESH TOKEN + DB CHECK
  // =========================
  static async verifyRefreshToken(token) {
    if (!token) return { valid: false, reason: "NO_TOKEN" };

    try {
      const decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET, {
        issuer: "doller-coach-api",
        audience: "doller-coach-client"
      });

      if (decoded.type !== "refresh") {
        return { valid: false, reason: "INVALID_TYPE" };
      }

      const exists = await RefreshToken.findOne({ jti: decoded.jti });

      if (!exists) {
        return { valid: false, reason: "TOKEN_REVOKED" };
      }

      return { valid: true, data: decoded };

    } catch (err) {
      return { valid: false, reason: err.name };
    }
  }

  // =========================
  // 🔁 ROTATE REFRESH TOKEN
  // =========================
  static async rotateRefreshToken(oldToken, user) {
    const result = await this.verifyRefreshToken(oldToken);

    if (!result.valid) {
      throw new Error(result.reason || "Invalid refresh token");
    }

    // ❌ delete old
    await RefreshToken.deleteOne({ jti: result.data.jti });

    // ✅ issue new
    const newRefresh = await this.generateRefreshToken(user);
    const newAccess = this.generateAccessToken(user);

    return {
      accessToken: newAccess,
      refreshToken: newRefresh
    };
  }

  // =========================
  // 🔓 LOGOUT (SINGLE DEVICE)
  // =========================
  static async revokeRefreshToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.jti) {
        await RefreshToken.deleteOne({ jti: decoded.jti });
      }
    } catch { }
  }

  // =========================
  // 🔓 LOGOUT ALL DEVICES
  // =========================
  static async revokeAll(user) {
    user.tokenVersion += 1;
    await user.save();

    await RefreshToken.deleteMany({ userId: user._id });
  }

  // =========================
  // 🔍 EXTRACT BEARER TOKEN
  // =========================
  static extractBearerToken(header) {
    if (!header) return null;

    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return null;
    }

    return parts[1];
  }

  // =========================
  // 🧪 DEBUG (SAFE DECODE)
  // =========================
  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch {
      return null;
    }
  }
}

module.exports = AuthService;