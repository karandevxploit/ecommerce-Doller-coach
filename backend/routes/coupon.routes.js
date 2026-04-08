const router = require("express").Router();
const { listCoupons, validateCoupon, applyCoupon } = require("../controllers/coupon.controller");
const { isAuthenticated } = require("../middlewares/auth.middleware");

/**
 * List all available (active & unexpired) coupons
 */
router.get("/", listCoupons);

/**
 * Apply coupon and calculate discount (Production-Ready)
 */
router.post("/apply", applyCoupon);

/**
 * Validate coupon against current cart
 */
router.post("/validate", isAuthenticated, validateCoupon);

module.exports = router;
