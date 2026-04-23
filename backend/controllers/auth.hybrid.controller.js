const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/user.model");
const PendingUser = require("../models/pendingUser.model");
const Otp = require("../models/otp.model");
const AuthService = require("../services/auth.service");
const { sendEmail } = require("../utils/sendEmail");
const { ok, fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");
const env = require("../config/env");

// ===============================
// CONFIG
// ===============================
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax", // Better compatibility for cross-port localhost
};

const ACCESS_TOKEN_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_AGE = 7 * 24 * 60 * 60 * 1000;

// ===============================
// HELPERS
// ===============================
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");

const buildUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
});

// ===============================
// GOOGLE INIT
// ===============================
const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

// ===============================
// TOKEN SENDER (SECURE)
// ===============================
const sendTokens = async (res, user, req) => {
  const accessToken = AuthService.generateAccessToken(user);
  const refreshToken = await AuthService.generateRefreshToken(user);

  res.cookie("token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_AGE,
  });

  res.cookie("refreshToken", refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_AGE,
  });

  return ok(res, {
    accessToken,
    user: buildUser(user),
  });
};

// ===============================
// REGISTER
// ===============================
exports.register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name)
    return fail(res, "All fields required", 400);

  if (password.length < 8)
    return fail(res, "Weak password", 400);

  const normalized = email.toLowerCase().trim();

  const exists = await User.findOne({ email: normalized });
  if (exists) return fail(res, "Email exists", 409);

  await PendingUser.deleteMany({ email: normalized });

  const code = String(Math.floor(100000 + Math.random() * 900000));

  await PendingUser.create({
    name,
    email: normalized,
    password: await bcrypt.hash(password, 12),
    otpHash: hash(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendEmail({
    to: normalized,
    subject: "OTP",
    html: `<b>${code}</b>`,
  });

  return ok(res, null, "OTP sent");
});

// ===============================
// LOGIN (SECURE)
// ===============================
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password +loginAttempts +lockUntil");

  if (!user) return fail(res, "Invalid credentials", 401);

  if (user.lockUntil > Date.now())
    return fail(res, "Account locked", 423);

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    user.loginAttempts++;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 30 * 60 * 1000;
    }
    await user.save();
    return fail(res, "Invalid credentials", 401);
  }

  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return sendTokens(res, user, req);
});

// ===============================
// REFRESH TOKEN (ROTATION)
// ===============================
exports.refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return fail(res, "Unauthorized", 401);

  try {
    const user = await User.findById(AuthService.decodeToken(token)?.sub);
    if (!user) return fail(res, "Invalid user", 401);

    const { accessToken, refreshToken } = await AuthService.rotateRefreshToken(token, user);

    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_AGE,
    });

    return ok(res, { accessToken });
  } catch (err) {
    logger.error("[REFRESH_ERROR]", err.message);
    return fail(res, err.message || "Invalid token", 401);
  }
});

// ===============================
// LOGOUT
// ===============================
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken || req.cookies.token;
  if (token) {
    await AuthService.revokeRefreshToken(token);
  }
  res.clearCookie("refreshToken");
  res.clearCookie("token");
  res.clearCookie("accessToken");
  return ok(res, null, "Logged out");
});

// ===============================
// VERIFY OTP
// ===============================
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const pending = await PendingUser.findOne({ email });
  if (!pending) return fail(res, "Invalid", 400);

  if (pending.expiresAt < Date.now())
    return fail(res, "Expired", 400);

  if (hash(otp) !== pending.otpHash)
    return fail(res, "Invalid OTP", 400);

  const user = await User.create({
    name: pending.name,
    email: pending.email,
    password: pending.password,
    emailVerified: true,
  });

  await PendingUser.deleteOne({ _id: pending._id });

  return sendTokens(res, user, req);
});

// ===============================
// GOOGLE LOGIN (SAFE)
// ===============================
exports.google = asyncHandler(async (req, res) => {
  if (!googleClient) {
    logger.error("[GOOGLE_AUTH] googleClient not initialized");
    return fail(res, "Google Auth is not configured", 503);
  }

  logger.info("[GOOGLE_AUTH_REQUEST]", { bodyKeys: Object.keys(req.body || {}) });

  const idToken = req.body?.token || req.body?.credential || req.body?.idToken;

  if (!idToken || typeof idToken !== "string") {
    logger.warn("[GOOGLE_AUTH_MISSING_TOKEN]", { body: req.body });
    return fail(res, "Google ID Token is missing or invalid", 400);
  }

  try {
    logger.debug("[GOOGLE_AUTH_VERIFYING]", { tokenLength: idToken.length });
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub, picture } = payload;

    if (!email) {
      return fail(res, "Google account must have an email associated", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    // 1. Check if user exists but used different provider
    if (user && user.provider !== "google") {
      logger.warn("[GOOGLE_AUTH_CONFLICT]", { email: normalizedEmail, provider: user.provider });
      return fail(res, `This email is already registered using ${user.provider}. Please log in with your password.`, 409);
    }

    // 2. Create user if not exists
    if (!user) {
      logger.info("[GOOGLE_AUTH_NEW_USER]", { email: normalizedEmail });
      user = await User.create({
        name: name || "Google User",
        email: normalizedEmail,
        googleId: sub,
        provider: "google",
        emailVerified: true,
        isVerified: true,
        avatar: picture || "",
        password: crypto.randomBytes(32).toString("hex"), // Dummy password for schema requirement
      });
    } else {
      // Update avatar if changed
      if (picture && user.avatar !== picture) {
        user.avatar = picture;
        await user.save();
      }
    }

    logger.info("[GOOGLE_AUTH_SUCCESS]", { email: normalizedEmail });
    return sendTokens(res, user, req);

  } catch (err) {
    logger.error("[GOOGLE_AUTH_ERROR]", { message: err.message, stack: err.stack });
    return fail(res, `Google Authentication failed: ${err.message}`, 401);
  }
});

// ===============================
// ADMIN: EXISTS (Hybrid Cached)
// ===============================
exports.adminExists = asyncHandler(async (req, res) => {
  const cache = require("../services/cache.service");
  
  return cache.getOrSet("admin:exists", async () => {
    const exists = await User.exists({ role: "admin" }).maxTimeMS(2000);
    return { exists: !!exists };
  }, 300).then(data => {
    return ok(res, data);
  }).catch(err => {
    logger.error("[ADMIN_EXISTS_ERROR]", err.message);
    return ok(res, { exists: true }); // Fail-safe
  });
});

// ===============================
// ADMIN: REGISTER (PROTECTED)
// ===============================
exports.adminRegister = asyncHandler(async (req, res) => {
  const { email, password, name, adminSecret } = req.body;

  if (adminSecret !== env.ADMIN_SECRET) {
    return fail(res, "Invalid admin secret", 403);
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return fail(res, "User already exists", 409);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: "admin",
    emailVerified: true
  });

  return sendTokens(res, user, req);
});

// ===============================
// ADMIN: LOGIN (ULTRA-FAST & SAFE)
// ===============================
exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return fail(res, "Missing email or password", 400);

  const normalizedEmail = email.toLowerCase().trim();

  // Find user and include sensitive fields
  const user = await User.findOne({ email: normalizedEmail })
    .select("+password +loginAttempts +lockUntil")
    .maxTimeMS(3000);

  if (!user || String(user.role).toLowerCase() !== "admin") {
    logger.warn("[ADMIN_LOGIN_FAIL] User not found or not admin", { email: normalizedEmail });
    return fail(res, "Invalid admin credentials", 401);
  }

  // Account Lock Check
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const remains = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return fail(res, `Account locked. Try again in ${remains} minutes.`, 423);
  }

  // Password Verification
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 30 * 60 * 1000;
      logger.warn("[ADMIN_ACCOUNT_LOCKED]", { email: normalizedEmail });
    }
    await user.save();
    return fail(res, "Invalid admin credentials", 401);
  }

  // Success: Reset Failures
  user.loginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIP = req.ip;
  await user.save();

  logger.info("[ADMIN_LOGIN_SUCCESS]", { email: normalizedEmail });

  return sendTokens(res, user, req);
});

// ===============================
// AUTH: STUBS (PREVENT CRASH)
// ===============================
exports.sendOtp = asyncHandler(async (req, res) => {
  return ok(res, null, "OTP logic pending migration");
});

exports.requestLoginOtp = asyncHandler(async (req, res) => {
  return ok(res, null, "Login OTP logic pending migration");
});

exports.resetPassword = asyncHandler(async (req, res) => {
  return ok(res, null, "Reset password logic pending migration");
});

exports.testEmail = asyncHandler(async (req, res) => {
  return ok(res, null, "Email test logic pending migration");
});

exports.testOrderEmail = asyncHandler(async (req, res) => {
  return ok(res, null, "Order email test logic pending migration");
});
