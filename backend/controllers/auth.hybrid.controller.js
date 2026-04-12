const User = require("../models/user.model");
const PendingUser = require("../models/pendingUser.model");
const asyncHandler = require("express-async-handler");
const AppError = require("../utils/AppError");
const AuthService = require("../services/auth.service");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Otp = require("../models/otp.model");
const { sendEmail } = require("../utils/sendEmail");
const { ok, fail } = require("../utils/apiResponse");
const logger = require("../utils/logger");
const env = require("../config/env");

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  ...REFRESH_TOKEN_COOKIE_OPTIONS,
  maxAge: 15 * 60 * 1000, // 15 minutes
};

function buildPublicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtpCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

const sendTokens = (res, user, message = "Success") => {
  const accessToken = AuthService.generateAccessToken(user);
  const refreshToken = AuthService.generateRefreshToken(user);

  res.cookie("accessToken", accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  return ok(res, {
    user: buildPublicUser(user),
    // Token is now in HttpOnly cookie, but we send it in body for legacy frontend support (optional)
    token: accessToken, 
  }, message);
};

exports.register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return fail(res, "Name, email and password are required", 400);
  }
  if (String(password).length < 8) { // Security upgrade: min 8 chars
    return fail(res, "Password must be at least 8 characters", 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    return fail(res, "Email already registered", 409);
  }

  await PendingUser.deleteMany({ email: normalizedEmail });

  const passwordHash = await bcrypt.hash(String(password), 12);
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await PendingUser.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: passwordHash,
    otpHash: codeHash,
    expiresAt,
  });

  // logger.info(`[Debug] Generating Registration OTP: ${code} for ${normalizedEmail}`);
  
  logger.info(`[TRACE] Triggering Registration for: ${normalizedEmail}`);
  
  try {
    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your Doller Coach account",
      html: `<p>Your OTP is <b>${code}</b>. Valid for 10 minutes.</p>`,
    });
    return ok(res, { email: normalizedEmail }, "OTP sent to your email");
  } catch (err) {
    logger.error(`[TRACE ERROR] Registration email failed for ${normalizedEmail}: ${err.message}`);
    return fail(res, "Failed to send verification email. Please try again.", 500);
  }
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return fail(res, "Email and password are required", 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password +loginAttempts +lockUntil");
  
  if (!user) {
    return fail(res, "Invalid email or password", 401);
  }

  // 1. Check if account is locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    return fail(res, `Account is temporarily locked. Try again in ${remainingTime} minutes.`, 423);
  }

  // 2. Verify password
  const isMatch = await bcrypt.compare(String(password), user.password || "");
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
      logger.warn(`Account locked: ${user.email} after 5 failed attempts.`);
    }
    await user.save();
    return fail(res, "Invalid email or password", 401);
  }

  if (!user.emailVerified) {
    return fail(res, "Email not verified", 403);
  }

  // 3. Reset lockout on success
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  logger.info(`User logged in: ${user.email}`);
  return sendTokens(res, user, "Login successful");
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie("accessToken", ACCESS_TOKEN_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", REFRESH_TOKEN_COOKIE_OPTIONS);
  return ok(res, null, "Logged out successfully");
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return fail(res, "Refresh token missing", 401);
  }

  const decoded = AuthService.verifyRefreshToken(refreshToken);
  if (!decoded) {
    return fail(res, "Invalid or expired refresh token", 401);
  }

  // Find user and include lockout fields just in case
  const user = await User.findById(decoded.id).select("+loginAttempts +lockUntil");
  if (!user) {
    return fail(res, "User not found", 401);
  }

  // Refresh Token Rotation: invalidate/clear old, send new
  return sendTokens(res, user, "Token refreshed");
});

exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return fail(res, "Email and password are required", 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password +loginAttempts +lockUntil");
  if (!user || user.role !== "admin") {
    logger.warn(`Unauthorized admin login attempt: ${email} (User found: ${Boolean(user)})`);
    return fail(res, "Access denied", 403);
  }

  // 1. Check if account is locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    return fail(res, `Account is temporarily locked. Try again in ${remainingTime} minutes.`, 423);
  }

  const isMatch = await bcrypt.compare(String(password), user.password || "");
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour lock for admin
      logger.error(`CRITICAL: Admin account locked: ${user.email} after 5 failed attempts.`);
    }
    await user.save();
    return fail(res, "Invalid email or password", 401);
  }

  // 2. Reset lockout on success
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  logger.info(`Admin logged in successfully: ${user.email}`);
  return sendTokens(res, user, "Admin login successful");
});

exports.adminRegister = asyncHandler(async (req, res) => {
  const { name, email, password, secret } = req.body || {};
  if (!name || !email || !password || !secret) {
    return fail(res, "All fields are required", 400);
  }

  if (secret !== process.env.ADMIN_SECRET) {
    logger.warn(`Invalid admin secret attempt for email: ${email}`);
    return fail(res, "Invalid admin secret", 401);
  }

  // Prevent registration in production unless explicitly allowed
  if (env.NODE_ENV === "production" && !process.env.ALLOW_ADMIN_REGISTRATION) {
    logger.warn(`Admin registration attempted in production for: ${email}`);
    return fail(res, "Registration disabled", 403);
  }

  const existingAdmin = await User.findOne({ role: "admin" }).lean();
  if (existingAdmin) {
    return fail(res, "Admin already exists", 403);
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: passwordHash,
    role: "admin",
    isAdmin: true,
    emailVerified: true,
    isVerified: true,
  });

  return ok(res, null, "Admin registered successfully", 201);
});

exports.adminExists = asyncHandler(async (_req, res) => {
  const admin = await User.findOne({ role: "admin" }).select("_id").lean();
  return ok(res, { exists: Boolean(admin) });
});

exports.sendOtp = asyncHandler(async (req, res) => {
  const email = String(req?.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return fail(res, "Invalid email", 400);

  const user = await User.findOne({ email });
  if (!user) return ok(res, null, "If the email exists, OTP has been sent");

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.updateMany({ userId: user._id, channel: "password_reset" }, { $set: { usedAt: new Date() } });
  await Otp.create({ userId: user._id, channel: "password_reset", email: user.email, codeHash, expiresAt });
  
  // logger.info(`[Debug] Generating Password Reset OTP: ${code} for ${user.email}`);

  await sendEmail({
    to: user.email,
    subject: "Doller Coach password reset OTP",
    html: `<p>Your password reset OTP is: <b>${code}</b>. Valid for 10 minutes.</p>`,
  });

  return ok(res, null, "OTP sent successfully");
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const email = String(req?.body?.email || "").trim().toLowerCase();
  const otp = String(req?.body?.otp || "");
  const purpose = String(req?.body?.purpose || "reset").toLowerCase();

  if (!email || !/^\d{6}$/.test(otp)) return fail(res, "Invalid request", 400);

  if (purpose === "signup") {
    const pending = await PendingUser.findOne({ email });
    if (!pending || pending.expiresAt <= new Date() || hashOtpCode(otp) !== pending.otpHash) {
      return fail(res, "Invalid or expired OTP", 401);
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      emailVerified: true,
      isVerified: true,
    });

    await PendingUser.deleteOne({ _id: pending._id });
    return sendTokens(res, user, "Registration successful");
  }

  const user = await User.findOne({ email });
  if (!user) return fail(res, "Invalid request", 401);

  const channel = purpose === "login" ? "login" : "password_reset";
  const record = await Otp.findOne({ userId: user._id, channel, usedAt: null }).sort({ createdAt: -1 });

  if (!record || record.expiresAt <= new Date() || hashOtpCode(otp) !== record.codeHash) {
    return fail(res, "Invalid or expired OTP", 401);
  }

  if (purpose === "login") {
    record.usedAt = new Date();
    await record.save();
    return sendTokens(res, user, "Login successful");
  }

  const resetToken = generateResetToken();
  record.usedAt = new Date();
  record.codeHash = hashOtpCode(resetToken); // Re-use for reset validaton
  record.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await record.save();

  return ok(res, { resetToken }, "OTP verified");
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, resetToken, newPassword } = req.body || {};

  if (!email || !resetToken || !newPassword || newPassword.length < 8) {
    return fail(res, "Invalid input", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return fail(res, "Invalid request", 400);

  const resetRecord = await Otp.findOne({
    userId: user._id,
    channel: "password_reset",
    codeHash: hashOtpCode(resetToken),
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) return fail(res, "Invalid or expired reset token", 400);

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  resetRecord.expiresAt = new Date();
  resetRecord.usedAt = new Date();
  await resetRecord.save();

  return ok(res, null, "Password reset successful");
});

exports.google = asyncHandler(async () => {
  throw new AppError("Direct Google sign-in is disabled. Use the /api/auth/google endpoint.", 501);
});

exports.phone = asyncHandler(async () => {
  throw new AppError("Phone OTP is disabled.", 501);
});

exports.requestLoginOtp = asyncHandler(async (req, res) => {
    // Similar to sendOtp but for login channel
    const email = String(req?.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return fail(res, "Invalid email", 400);
  
    const user = await User.findOne({ email });
    if (!user) return ok(res, null, "If the email exists, OTP has been sent");
  
    const code = generateOtpCode();
    await Otp.updateMany({ userId: user._id, channel: "login" }, { $set: { usedAt: new Date() } });
    await Otp.create({ userId: user._id, channel: "login", email: user.email, codeHash: hashOtpCode(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  
    // logger.info(`[Debug] Generating Login OTP: ${code} for ${user.email}`);

    await sendEmail({
      to: user.email,
      subject: "Login code for Doller Coach",
      text: `Your login OTP is: ${code}. Valid for 10 minutes.`,
      html: `<p>Your login OTP is: <b>${code}</b>. Valid for 10 minutes.</p>`,
    });
  
    return ok(res, null, "Login OTP sent");
});

exports.testEmail = asyncHandler(async (req, res) => {
  const to = String(req.query.email || "").trim();
  if (!to) return fail(res, "Recipient email (?email=) is required", 400);

  logger.info(`[Diagnostic] Attempting to send dynamic test email to: ${to}`);

  try {
    const result = await sendEmail({
      to,
      subject: "Doller Coach - Dynamic Verification Test",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #000;">Brevo Integration Active</h2>
          <p>This is a dynamic test email sent to: <b>${to}</b></p>
          <p>If you received this, your <b>Verified Sender</b> is configured correctly.</p>
          <hr/>
          <p style="font-size: 10px; color: #999;">Diagnostic Time: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    return ok(res, { messageId: result.messageId }, `Success! Test email sent to ${to}`);
  } catch (err) {
    logger.error(`[Diagnostic Failed] ${err.message}`);
    return fail(res, `Email failed: ${err.message}`, 500);
  }
});

exports.testOrderEmail = asyncHandler(async (req, res) => {
  const to = String(req.query.email || "").trim();
  if (!to) return fail(res, "Recipient email (?email=) is required", 400);

  const emailService = require("../services/email.service");
  
  // Create a high-fidelity mock order
  const mockOrder = {
    _id: "661414141414141414141414",
    totalAmount: 14500,
    createdAt: new Date(),
    products: [
      { title: "Elite Chrono S1", quantity: 1, price: 9500 },
      { title: "Matte Carbon Straps", quantity: 1, price: 5000 }
    ],
    address: { name: "Elite Customer", phone: "9999999999" }
  };

  const mockCustomer = {
    name: "Elite Customer",
    email: to
  };

  logger.info(`[Diagnostic] Triggering MOCK Order Email to: ${to}`);

  try {
    await emailService.sendOrderPlacedEmails({ order: mockOrder, customer: mockCustomer });
    return ok(res, { orderId: mockOrder._id }, `Success! Mock order email sent to ${to}. Check logs for MessageID.`);
  } catch (err) {
    logger.error(`[Diagnostic Failed] ${err.message}`);
    return fail(res, `Mock Order Email failed: ${err.message}`, 500);
  }
});
