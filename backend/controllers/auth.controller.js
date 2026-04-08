const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const crypto = require("crypto");
const User = require("../models/user.model");
const Otp = require("../models/otp.model");
const asyncHandler = require("express-async-handler");
const AppError = require("../utils/AppError");
const { ok, fail } = require("../utils/apiResponse");
const logger = require("../utils/logger");
const AuthService = require("../services/auth.service");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const otpSchema = z.string().regex(/^\d{6}$/);

function signToken(user) {
  return AuthService.generateAccessToken(user);
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtpCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function createAndStoreOtp({ userId, channel, email, phone }) {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Invalidate any previous unused OTPs for the same user+channel.
  await Otp.updateMany({ userId, channel, usedAt: null }, { $set: { usedAt: new Date() } });

  await Otp.create({
    userId,
    channel,
    email: channel === "email" ? email : null,
    phone: channel === "phone" ? phone : null,
    codeHash,
    expiresAt,
    attempts: 0,
    usedAt: null,
  });

  return { code, expiresAt };
}

async function verifyOtpAndInvalidate({ userId, channel, code }) {
  const otpRecord = await Otp.findOne({ userId, channel, usedAt: null }).sort({ createdAt: -1 }).lean();
  if (!otpRecord) throw new AppError("OTP not found or already used", 400);
  if (!otpRecord.expiresAt || otpRecord.expiresAt <= new Date()) throw new AppError("OTP expired", 400);

  const nextHash = hashOtpCode(code);
  const isValid = nextHash === otpRecord.codeHash;
  if (!isValid) {
    const nextAttempts = (otpRecord.attempts || 0) + 1;
    const maxAttempts = 5;
    await Otp.updateOne({ _id: otpRecord._id }, { $set: { attempts: nextAttempts } });
    if (nextAttempts >= maxAttempts) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { usedAt: new Date() } });
      throw new AppError("Too many invalid OTP attempts. Please request a new code.", 429);
    }
    throw new AppError("Invalid OTP", 401);
  }

  await Otp.updateOne({ _id: otpRecord._id }, { $set: { usedAt: new Date() } });
  return true;
}

exports.register = asyncHandler(async (req, res) => {
  req.body.provider = "email";
  const payload = registerSchema.parse(req.body);
  const exists = await User.findOne({ email: payload.email });
  if (exists) {
    return fail(res, "Email already registered", 409);
  }
  const phoneExists = await User.findOne({ phone: payload.phone });
  if (phoneExists) {
    return fail(res, "Phone number already registered", 409);
  }

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    role: "user",
    provider: "email",
    emailVerified: false,
    phoneVerified: false,
  });

  logger.info(`New user registered: ${user.email}`);

  const [emailOtp, phoneOtp] = await Promise.all([
    createAndStoreOtp({ userId: user._id, channel: "email", email: user.email, phone: user.phone }),
    createAndStoreOtp({ userId: user._id, channel: "phone", email: user.email, phone: user.phone }),
  ]);

  const verificationRequired = { email: true, phone: true };
  const response = {
    user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    verificationRequired,
  };

  return ok(res, response, "Registration successful", 201);
});

exports.login = asyncHandler(async (req, res) => {
  req.body.provider = "email";
  const payload = loginSchema.parse(req.body);
  const user = await User.findOne({ email: payload.email }).select("+password");
  if (!user) {
    return fail(res, "Invalid email or password", 401);
  }
  const valid = await user.comparePassword(payload.password);
  if (!valid) {
    return fail(res, "Invalid email or password", 401);
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: "Verify your email to continue",
      data: {
        verificationRequired: { email: true, phone: Boolean(user.phone && !user.phoneVerified) },
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      }
    });
  }

  if (user.phone && !user.phoneVerified) {
    return res.status(403).json({
      success: false,
      message: "Verify your phone to continue",
      data: {
        verificationRequired: { email: false, phone: true },
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      }
    });
  }

  return sendTokens(res, user, "Login successful");
});

const sendTokens = (res, user, message = "Success") => {
  const accessToken = AuthService.generateAccessToken(user);
  const refreshToken = AuthService.generateRefreshToken(user);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return ok(res, {
    token: accessToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  }, message);
};

exports.googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) throw new AppError("Credential required", 400);

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { email, name, sub: googleId } = ticket.getPayload();
  if (!email) throw new AppError("Invalid Google token", 400);

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name: name || "Google User",
      email,
      googleId,
      provider: "google",
      isVerified: true,
      emailVerified: true,
      role: "user",
      password: crypto.randomBytes(32).toString("hex")
    });
  } else {
    user.isVerified = true;
    user.emailVerified = true;
    if (!user.googleId) user.googleId = googleId;
    user.provider = "google";
    await user.save();
  }

  return sendTokens(res, user, "Google login successful");
});

exports.verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = z.object({ email: z.string().email(), otp: otpSchema }).parse(req.body);
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", 404);

  await verifyOtpAndInvalidate({ userId: user._id, channel: "email", code: otp });
  user.emailVerified = true;
  await user.save();

  if (user.phone && !user.phoneVerified) {
    // Ensure phone step always has a valid OTP to verify next.
    await createAndStoreOtp({ userId: user._id, channel: "phone", email: user.email, phone: user.phone });
    return ok(res, {
      verificationRequired: { email: false, phone: true },
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    }, "Email verified, phone verification required");
  }

  return sendTokens(res, user, "Email verified successfully");
});

exports.verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = z.object({ phone: z.string().min(7), otp: otpSchema }).parse(req.body);
  const user = await User.findOne({ phone });
  if (!user) throw new AppError("User not found", 404);

  await verifyOtpAndInvalidate({ userId: user._id, channel: "phone", code: otp });
  user.phoneVerified = true;
  await user.save();

  if (!user.emailVerified) {
    await createAndStoreOtp({ userId: user._id, channel: "email", email: user.email, phone: user.phone });
    return ok(res, {
      verificationRequired: { email: true, phone: false },
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    }, "Phone verified, email verification required");
  }

  return sendTokens(res, user, "Phone verified successfully");
});

exports.resendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", 404);
  await createAndStoreOtp({ userId: user._id, channel: "email", email: user.email, phone: user.phone });
  return ok(res, {
    verificationRequired: { email: !user.emailVerified, phone: Boolean(user.phone && !user.phoneVerified) },
  }, "Email OTP resent");
});

exports.resendPhoneOtp = asyncHandler(async (req, res) => {
  const { phone } = z.object({ phone: z.string().min(7) }).parse(req.body);
  const user = await User.findOne({ phone });
  if (!user) throw new AppError("User not found", 404);
  await createAndStoreOtp({ userId: user._id, channel: "phone", email: user.email, phone: user.phone });
  return ok(res, {
    verificationRequired: { email: !user.emailVerified, phone: !user.phoneVerified },
  }, "Phone OTP resent");
});

