const { z } = require("zod");

const email = z.string().email("Invalid email address").toLowerCase().trim();
const password = z.string().min(6, "Password must be at least 6 characters").max(128);
const otp = z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits");

const purpose = z.preprocess(
  (value) => String(value || "signup").trim().toLowerCase().replace(/_/g, "-"),
  z.enum([
    "signup",
    "register",
    "email",
    "verify-email",
    "password-reset",
    "reset-password",
    "forgot-password",
    "reset",
    "login",
  ]).default("signup")
);

exports.registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name is too short").max(100).trim(),
    email,
    phone: z.string().trim().optional(),
    password: password.min(8, "Password must be at least 8 characters"),
  }).passthrough(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, "Password is required"),
  }).passthrough(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.verifyOtpSchema = z.object({
  body: z.object({
    email,
    otp,
    purpose: purpose.optional().default("signup"),
  }).passthrough(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.resetPasswordSchema = z.object({
  body: z.object({
    email,
    resetToken: z.string().optional(),
    token: z.string().optional(),
    otp: z.string().optional(),
    newPassword: password.optional(),
    password: password.optional(),
  }).passthrough().refine((body) => body.resetToken || body.token || body.otp, {
    message: "Reset token is required",
    path: ["resetToken"],
  }).refine((body) => body.newPassword || body.password, {
    message: "New password is required",
    path: ["newPassword"],
  }),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});

exports.sendOtpSchema = z.object({
  body: z.object({
    email,
    purpose: purpose.optional().default("signup"),
    name: z.string().min(2).max(100).trim().optional(),
    password: password.optional(),
  }).passthrough(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});
