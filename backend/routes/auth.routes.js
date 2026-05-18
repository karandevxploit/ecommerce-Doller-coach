const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const validate = require("../middlewares/validate.middleware");
const validateRegister = require("../middlewares/validateRegister.middleware");
const mongoose = require("mongoose");

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
  resendOtp,
  resetPassword,
  requestLoginOtp,
  testEmail,
  testOrderEmail,
  google,
} = require("../controllers/auth.hybrid.controller");

const { isAuthenticated, isAdmin } = require("../middlewares/auth.middleware");
const User = require("../models/user.model");
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
router.post("/login", authLimiter, validate(loginSchema), safeHandler(login));
router.post("/signin", authLimiter, validate(loginSchema), safeHandler(login));
router.post("/logout", safeHandler(logout));
router.post("/refresh-token", authLimiter, safeHandler(refreshToken));

/**
 * ADMIN AUTH (STRICT)
 */
router.post("/admin-login", authLimiter, safeHandler(adminLogin));

router.post("/admin-register", authLimiter, safeHandler(adminRegister));
router.get("/admin-exists", authLimiter, safeHandler(adminExists));

/**
 * USER REGISTER
 */
router.post("/register", authLimiter, validateRegister, validate(registerSchema), safeHandler(register));
router.post("/signup", authLimiter, validateRegister, validate(registerSchema), safeHandler(register));

/**
 * EMAIL TEST (ADMIN ONLY)
 */
router.get("/test-email", isAuthenticated, isAdmin, safeHandler(testEmail));
router.get("/test-order-email", isAuthenticated, isAdmin, safeHandler(testOrderEmail));

/**
 * OTP FLOW (HARDENED)
 */
router.post("/send-otp", authLimiter, validate(sendOtpSchema), safeHandler(sendOtp));
router.post("/request-login-otp", authLimiter, safeHandler(requestLoginOtp));
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), safeHandler(verifyOtp));
router.post("/resend-otp", authLimiter, safeHandler(resendOtp));
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), safeHandler(resetPassword));

/**
 * GOOGLE AUTH
 */
router.post("/google", authLimiter, safeHandler(google));

/**
 * PROFILE + NOTIFICATIONS
 */
router.get("/profile", isAuthenticated, safeHandler(profile));
router.get("/me", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(String(userId || ""))) {
      return res.status(401).json({ success: false, message: "Invalid session" });
    }

    const user = await User
      .findOne({ _id: userId, isDeleted: { $ne: true } })
      .select("-password")
      .lean();

    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    res.json({ success: true, user, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
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
