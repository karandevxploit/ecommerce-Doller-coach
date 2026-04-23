const { z } = require("zod");

// Base validation components
const email = z.string().email("Invalid structural integrity for email").toLowerCase().trim();
const password = z.string().min(8, "Password requires 8 characters minimum for compliance");
const otp = z.string().length(6, "OTP token must be exactly 6 characters");

/**
 * AUTHENTICATION SCHEMAS
 * Rejects any unknown fields via .strict() to neutralize NoSQL injection attacks.
 */

exports.registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name manifest too short").max(50).trim(),
    email,
    password,
  }).strict(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.loginSchema = z.object({
  body: z.object({
    email,
    password,
  }).strict(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.verifyOtpSchema = z.object({
  body: z.object({
    email,
    otp,
    purpose: z.enum(["signup", "password_reset", "login"]),
  }).strict(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.resetPasswordSchema = z.object({
  body: z.object({
    email,
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: password,
  }).strict(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.sendOtpSchema = z.object({
  body: z.object({
    email,
  }).strict(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});
