const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const {
  register,
  login,
  logout,
  refreshToken,
  google: legacyGoogle,
  phone,
  adminLogin,
  adminRegister,
  adminExists,
  sendOtp,
  verifyOtp,
  resetPassword,
  requestLoginOtp,
  testEmail,
  testOrderEmail,
} = require("../controllers/auth.hybrid.controller");

const { googleAuth } = require("../controllers/auth.controller");

const { isAuthenticated, isAdmin } = require("../middlewares/auth.middleware");
const { profile, saveFcmToken } = require("../controllers/user.controller");
const {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../controllers/address.controller");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: "Too many login attempts. Please try again later." });
const adminAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: "Too many admin login attempts." });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: "Too many OTP requests." });

router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.post("/admin-login", adminAuthLimiter, adminLogin);
router.post("/admin-register", authLimiter, adminRegister);
router.get("/admin-exists", authLimiter, adminExists);
router.post("/register", authLimiter, register);
router.get("/test-email", testEmail);
router.get("/test-order-email", testOrderEmail);

router.post("/send-otp", otpLimiter, sendOtp);
router.post("/request-login-otp", otpLimiter, requestLoginOtp);
router.post("/verify-otp", otpLimiter, verifyOtp);
router.post("/reset-password", otpLimiter, resetPassword);

router.post("/google", authLimiter, googleAuth);
router.post("/phone", authLimiter, phone);

// Unified Profile + Notifications
router.get("/profile", isAuthenticated, profile);
router.post("/fcm-token", isAuthenticated, saveFcmToken);
router.get("/notifications", isAuthenticated, require("../controllers/notification.controller").myNotifications);

// Unified Addresses
router.get("/addresses", isAuthenticated, listAddresses);
router.post("/addresses", isAuthenticated, createAddress);
router.put("/addresses/:id", isAuthenticated, updateAddress);
router.delete("/addresses/:id", isAuthenticated, deleteAddress);
router.post("/addresses/:id/set-default", isAuthenticated, setDefaultAddress);

module.exports = router;
