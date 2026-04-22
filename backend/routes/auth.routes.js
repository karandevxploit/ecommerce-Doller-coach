const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");
const { verifyRecaptcha } = require("../middlewares/recaptcha.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const validate = require("../middlewares/validate.middleware");
const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

const {
  register,
  login,
  logout,
  refreshToken,
  adminLogin,
  adminRegister,
  adminExists,
  sendOtp,
  verifyOtp,
  resetPassword,
  requestLoginOtp,
  testEmail,
  testOrderEmail,
  google,
} = require("../controllers/auth.hybrid.controller");

const { isAuthenticated, isAdmin } = require("../middlewares/auth.middleware");
const { profile, saveFcmToken } = require("../controllers/user.controller");
const notificationController = require("../controllers/notification.controller");

const {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../controllers/address.controller");

const {
  loginSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} = require("../validations/auth.validation");

/**
 * PARAM VALIDATION
 */
const validateObjectId = (req, res, next) => {
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid ID" });
  }
  next();
};

/**
 * AUTH ROUTES (HARDENED)
 */
router.post("/login", authLimiter, verifyRecaptcha("login"), validate(loginSchema), safeHandler(login));
router.post("/logout", safeHandler(logout));
router.post("/refresh-token", authLimiter, safeHandler(refreshToken));

/**
 * ADMIN AUTH (STRICT)
 */
router.post("/admin-login", (req, res, next) => {
  console.log(">>> [ROUTE_HIT] POST /api/auth/admin-login at", new Date().toISOString());
  next();
}, safeHandler(adminLogin));

// ⚠️ PROTECT THIS (should be internal or restricted)
router.post("/admin-register", isAuthenticated, isAdmin, authLimiter, safeHandler(adminRegister));
router.get("/admin-exists", authLimiter, safeHandler(adminExists));

/**
 * USER REGISTER
 */
router.post("/register", authLimiter, verifyRecaptcha("register"), validate(registerSchema), safeHandler(register));

/**
 * EMAIL TEST (ADMIN ONLY)
 */
router.get("/test-email", isAuthenticated, isAdmin, safeHandler(testEmail));
router.get("/test-order-email", isAuthenticated, isAdmin, safeHandler(testOrderEmail));

/**
 * OTP FLOW (HARDENED)
 */
router.post("/send-otp", authLimiter, verifyRecaptcha("default"), validate(sendOtpSchema), safeHandler(sendOtp));
router.post("/request-login-otp", authLimiter, verifyRecaptcha("default"), safeHandler(requestLoginOtp));
router.post("/verify-otp", authLimiter, verifyRecaptcha("default"), validate(verifyOtpSchema), safeHandler(verifyOtp));
router.post("/reset-password", authLimiter, verifyRecaptcha("default"), validate(resetPasswordSchema), safeHandler(resetPassword));

/**
 * GOOGLE AUTH
 */
router.post("/google", authLimiter, verifyRecaptcha("default"), safeHandler(google));

// ❌ REMOVED google-debug (should not exist in production)

/**
 * PROFILE + NOTIFICATIONS
 */
router.get("/profile", isAuthenticated, safeHandler(profile));
router.post("/fcm-token", isAuthenticated, safeHandler(saveFcmToken));
router.get("/notifications", isAuthenticated, safeHandler(notificationController.myNotifications));

/**
 * ADDRESS MANAGEMENT (SAFE)
 */
router.get("/addresses", isAuthenticated, safeHandler(listAddresses));
router.post("/addresses", isAuthenticated, safeHandler(createAddress));
router.put("/addresses/:id", isAuthenticated, validateObjectId, safeHandler(updateAddress));
router.delete("/addresses/:id", isAuthenticated, validateObjectId, safeHandler(deleteAddress));
router.post("/addresses/:id/set-default", isAuthenticated, validateObjectId, safeHandler(setDefaultAddress));

module.exports = router;