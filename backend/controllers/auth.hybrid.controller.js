const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/user.model");
const PendingUser = require("../models/pendingUser.model");
const Otp = require("../models/otp.model");
const AuthService = require("../services/auth.service");
const { sendEmail, sendOtpEmail } = require("../utils/sendEmail");
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

const REFRESH_TOKEN_AGE = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_AGE = 15 * 60 * 1000;
const ADMIN_ACCESS_TOKEN_AGE = 3 * 60 * 60 * 1000;
const OTP_EXP_MINUTES = 10;

// ===============================
// HELPERS
// ===============================
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const normalizePhone = (value = "") => String(value || "").replace(/\D/g, "").slice(-10);
const normalizeOtpPurpose = (purpose = "signup") => {
  const value = String(purpose || "signup").trim().toLowerCase().replace(/_/g, "-");

  if (["register", "signup", "email", "verify-email"].includes(value)) return "signup";
  if (["reset", "reset-password", "password-reset", "forgot-password"].includes(value)) return "password_reset";
  if (value === "login") return "login";

  return value;
};

const buildUser = (u) => ({
  id: String(u._id || u.id),
  _id: String(u._id || u.id),
  name: u.name,
  email: u.email,
  role: u.role || "user",
  avatar: u.avatar || "",
  isVerified: Boolean(u.isVerified || u.emailVerified),
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
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const accessMaxAge = isAdmin ? ADMIN_ACCESS_TOKEN_AGE : ACCESS_TOKEN_AGE;
  const accessToken = AuthService.generateAccessToken(user, isAdmin ? "3h" : undefined);
  let refreshToken = null;

  try {
    refreshToken = await AuthService.generateRefreshToken(user);
  } catch (err) {
    logger.warn(`[AUTH_REFRESH_TOKEN_SKIP] ${err.message}`);
  }

  res.cookie("token", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: accessMaxAge,
  });

  res.cookie("accessToken", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: accessMaxAge,
  });

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_AGE,
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      user: buildUser(user),
      token: accessToken,
      accessToken,
      refreshToken,
    },
    user: buildUser(user),
    token: accessToken,
    accessToken,
    refreshToken,
    message: "Login successful",
  });
};

// ===============================
// REGISTER (OTP-BASED - HARDENED)
// ===============================
exports.register = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const reqId = Math.random().toString(36).substring(7);

  try {
    const { email, password, name, phone } = req.body;

    // STEP 1: INPUT VALIDATION
    if (!email?.trim() || !password?.trim() || !name?.trim()) {
      logger.warn(`[REGISTER_VALIDATION_FAIL][${reqId}] Missing required fields`, { email, name, hasPassword: !!password });
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long"
      });
    }

    const normalized = email.toLowerCase().trim();
    let normalizedPhone = normalizePhone(phone);

    // STEP 3: HASH PASSWORD SAFELY
    let passwordHash;
    try {
      passwordHash = await bcrypt.hash(password, 12);
    } catch (hashError) {
      logger.error(`[REGISTER_HASH_FAIL][${reqId}]`, hashError);
      return fail(res, "Registration service temporarily unavailable", 503);
    }

    // STEP 4: CREATE OR REFRESH UNVERIFIED USER
    let user;
    try {
      const existingByEmail = await User.findOne({
        email: normalized,
        isDeleted: { $ne: true },
      }).select("+password");

      const existingByPhone = normalizedPhone
        ? await User.findOne({
          phoneNormalized: normalizedPhone,
          isDeleted: { $ne: true },
        }).select("+password")
        : null;

      const verifiedEmailOwner =
        existingByEmail &&
        (existingByEmail.isVerified || existingByEmail.emailVerified);

      if (verifiedEmailOwner) {
        logger.info(`[REGISTER_DUPLICATE_EMAIL][${reqId}] ${normalized}`);
        return fail(res, "Email is already registered. Please login instead.", 409);
      }

      const verifiedPhoneOwner =
        existingByPhone &&
        String(existingByPhone._id) !== String(existingByEmail?._id || "") &&
        (existingByPhone.isVerified || existingByPhone.phoneVerified || existingByPhone.emailVerified);

      if (verifiedPhoneOwner) {
        logger.info(`[REGISTER_PHONE_REUSED_SKIP][${reqId}] ${normalizedPhone}`);
        normalizedPhone = "";
      }

      user = existingByEmail || (verifiedPhoneOwner ? null : existingByPhone);

      if (user) {
        if (
          existingByEmail &&
          existingByPhone &&
          String(existingByEmail._id) !== String(existingByPhone._id)
        ) {
          existingByPhone.phone = undefined;
          existingByPhone.phoneNormalized = undefined;
          await existingByPhone.save();
        }

        user.name = String(name).trim();
        user.email = normalized;
        user.phone = normalizedPhone || undefined;
        user.password = passwordHash;
        user.provider = "email";
        user.emailVerified = false;
        user.isVerified = false;
        await user.save();
        logger.info(`[REGISTER_UNVERIFIED_REFRESHED][${reqId}] User: ${user._id}`);
      } else {
        user = await User.create({
          name: String(name).trim(),
          email: normalized,
          phone: normalizedPhone || undefined,
          password: passwordHash,
          provider: "email",
          emailVerified: false,
          isVerified: false,
        });
        logger.info(`[REGISTER_USER_CREATED][${reqId}] User: ${user._id}`);
      }
    } catch (userError) {
      logger.error(`[REGISTER_USER_CREATE_FAIL][${reqId}]`, userError);
      if (userError.code === 11000) {
        const duplicateField = Object.keys(userError.keyPattern || {})[0] || "";
        const duplicateMessage = duplicateField.toLowerCase().includes("phone")
          ? "Phone number is already registered. Please use another number or login."
          : "Email is already registered. Please login instead.";
        return fail(res, duplicateMessage, 409);
      }
      return fail(res, userError.message || "Failed to create user account", 400);
    }

    // STEP 5: GENERATE AND SAVE OTP
    const otp = generateOtp();
    const otpHash = hash(otp);
    const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

    let otpDoc;
    try {
      // Use the safe static method that deletes old OTPs first
      otpDoc = await Otp.createOtp({
        userId: user._id,
        channel: "signup",
        email: normalized,
        codeHash: otpHash,
        expiresAt,
      });
      logger.info(`[REGISTER_OTP_CREATED][${reqId}] OTP: ${otpDoc._id}`);
    } catch (otpError) {
      logger.error(`[REGISTER_OTP_FAIL][${reqId}]`, otpError);
      // If OTP fails, still don't fail the registration - email it later
    }

    // STEP 6: SEND OTP EMAIL
    try {
      await sendOtpEmail({
        to: normalized,
        name,
        otp,
        minutes: OTP_EXP_MINUTES,
      });
    } catch (mailError) {
      logger.error(`[REGISTER_EMAIL_ERROR][${reqId}] Failed to send to ${normalized}: ${mailError.message}`);
      return fail(res, "Account created, but OTP email could not be sent. Please try resend code after a minute.", 503);
    }

    const duration = Date.now() - startTime;
    logger.info(`[REGISTER_SUCCESS][${reqId}] Completed in ${duration}ms`);

    // STEP 7: RETURN SUCCESS
    return ok(res, {
      success: true,
      message: "Registration successful! Check your email for verification code.",
      email: normalized,
      requiresVerification: true,
      otpExpiresIn: OTP_EXP_MINUTES * 60, // seconds
    }, "Registration successful! Check your email for verification code.", 201);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[REGISTER_UNEXPECTED_ERROR][${reqId}]`, {
      error: error.message,
      stack: error.stack,
      duration,
    });
    return fail(res, "An unexpected error occurred during registration", 500);
  }
});

// ===============================
// LOGIN (SECURE - VERIFICATION REQUIRED)
// ===============================
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return fail(res, "Email and password are required", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password +loginAttempts +lockUntil");

  if (!user) return fail(res, "Invalid credentials", 401);

  // Check if user is verified
  if (!user.isVerified) {
    return fail(res, "Please verify your email before logging in", 403);
  }

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
  user.lastLoginAt = new Date();
  user.lastLoginIP = req.ip;
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

    res.cookie("token", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_AGE,
    });

    res.cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_AGE,
    });

    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_AGE,
    });

    return ok(res, {
      token: accessToken,
      accessToken,
      refreshToken,
      user: buildUser(user),
    });
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
// RESEND OTP
// ===============================
exports.resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();

  if (!normalizedEmail) return fail(res, "Email is required", 400);

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return fail(res, "User not found", 404);

  if (user.isVerified) {
    return fail(res, "Email already verified", 400);
  }

  // Check for recent OTP (prevent spam)
  const recentOtp = await Otp.findOne({
    userId: user._id,
    channel: "signup",
    email: normalizedEmail,
    createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // Within last minute
  });

  if (recentOtp) {
    return fail(res, "Please wait before requesting another OTP", 429);
  }

  // Generate new OTP
  const otp = generateOtp();
  const otpHash = hash(otp);
  const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

  // Save new OTP
  await Otp.create({
    userId: user._id,
    channel: "signup",
    email: normalizedEmail,
    codeHash: otpHash,
    expiresAt,
  });

  // Send OTP email
  try {
    await sendOtpEmail({
      to: normalizedEmail,
      name: user.name,
      otp,
      minutes: OTP_EXP_MINUTES,
    });
  } catch (emailError) {
    logger.error("[RESEND_OTP_EMAIL_ERROR]", emailError);
    return fail(res, "Failed to send email. Please try again later", 500);
  }

  return ok(res, { message: "OTP sent successfully", email: normalizedEmail });
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
  try {
    const exists = await User.exists({ role: "admin" });
    return ok(res, { exists: Boolean(exists) });
  } catch (err) {
    logger.error("[ADMIN_EXISTS_ERROR]", err.message);
    return ok(res, { exists: true }); // Fail-safe
  }
});

// ===============================
// ADMIN: REGISTER (FIRST ADMIN ONLY)
// ===============================
exports.adminRegister = asyncHandler(async (req, res) => {
  const { email, password, name, adminSecret } = req.body;

  const existingAdmin = await User.exists({ role: "admin" });
  if (existingAdmin) {
    return fail(res, "Admin account already exists. Please login.", 409);
  }

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

  const cache = require("../services/cache.service");
  await cache.del("admin:exists").catch(() => {});

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
    .select("+password +loginAttempts +lockUntil");

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
    logger.warn("[ADMIN_LOGIN_PASSWORD_MISMATCH]", { email: normalizedEmail });
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
// VERIFY OTP (REGISTER / LOGIN / PASSWORD RESET)
// ===============================
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp, purpose = "signup", newPassword } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const code = String(otp || req.body.resetToken || req.body.token || "").trim();
  const channel = normalizeOtpPurpose(purpose);

  if (!normalizedEmail) return fail(res, "Email is required", 400);
  if (!/^\d{6}$/.test(code)) return fail(res, "Valid 6-digit OTP is required", 400);

  const codeHash = hash(code);

  if (channel === "signup") {
    let user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (user) {
      await Otp.verifyOtp({ userId: user._id, channel: "signup", codeHash });
      user.isVerified = true;
      user.emailVerified = true;
      await user.save();
      return sendTokens(res, user, req);
    }

    const pending = await PendingUser.verifyOtp({ email: normalizedEmail, otpHash: codeHash });
    user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      provider: "email",
      emailVerified: true,
      isVerified: true,
    });

    return sendTokens(res, user, req);
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+password +loginAttempts +lockUntil");
  if (!user) return fail(res, "User not found", 404);

  if (channel === "login") {
    await Otp.verifyOtp({ userId: user._id, channel: "login", codeHash });
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save();
    return sendTokens(res, user, req);
  }

  if (channel === "password_reset") {
    await Otp.verifyOtp({ userId: user._id, channel: "password_reset", codeHash });

    const nextPassword = newPassword || req.body.password;
    if (nextPassword) {
      if (String(nextPassword).length < 6) return fail(res, "Password must be at least 6 characters", 400);
      user.password = String(nextPassword);
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save();
      return ok(res, { updated: true }, "Password updated successfully");
    }

    return ok(res, {
      resetToken: code,
      token: code,
      email: normalizedEmail,
      expiresIn: OTP_EXP_MINUTES * 60,
    }, "OTP verified");
  }

  return fail(res, "Unsupported OTP purpose", 400);
});
// ===============================
// AUTH: STUBS (PREVENT CRASH)
// ===============================
exports.sendOtp = asyncHandler(async (req, res) => {
  const { email, purpose = "signup", name, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const channel = normalizeOtpPurpose(purpose);
  if (!normalizedEmail) return fail(res, "Email is required", 400);

  const otp = generateOtp();
  const codeHash = hash(otp);
  const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

  if (channel === "signup") {
    if (!name || !password) {
      return fail(res, "Name and password are required for signup OTP", 400);
    }
    const exists = await User.exists({ email: normalizedEmail });
    if (exists) return fail(res, "Email already registered", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    await PendingUser.createPendingUser({
      name,
      email: normalizedEmail,
      passwordHash,
      otpHash: codeHash,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });
  } else {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return fail(res, "User not found", 404);
    await Otp.createOtp({
      userId: user._id,
      email: normalizedEmail,
      channel,
      codeHash,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });
  }

  await sendOtpEmail({
    to: normalizedEmail,
    name: "Doller Coach customer",
    otp,
    minutes: OTP_EXP_MINUTES,
  });

  return ok(res, { email: normalizedEmail, purpose: channel }, "OTP sent successfully");
});

exports.requestLoginOtp = asyncHandler(async (req, res) => {
  req.body.purpose = "login";
  return exports.sendOtp(req, res);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, resetToken, token, otp, newPassword, password } = req.body;
  req.body = {
    email,
    otp: resetToken || token || otp,
    purpose: "password_reset",
    newPassword: newPassword || password,
  };
  return exports.verifyOtp(req, res);
});

exports.testEmail = asyncHandler(async (req, res) => {
  const to = req.query.to || req.user?.email;
  await sendEmail({
    to,
    subject: "Brevo test email",
    html: "<p>Brevo test email sent successfully.</p>",
  });
  return ok(res, { to }, "Test email queued");
});

exports.testOrderEmail = asyncHandler(async (req, res) => {
  const to = req.query.to || req.user?.email;
  await sendEmail({
    to,
    subject: "Order placed confirmation",
    html: "<p>Your order has been placed successfully.</p>",
  });
  return ok(res, { to }, "Order email queued");
});
