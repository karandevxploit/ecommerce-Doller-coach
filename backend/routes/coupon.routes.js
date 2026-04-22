const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { isAuthenticated } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    listCoupons,
    validateCoupon,
    applyCoupon,
} = require("../controllers/coupon.controller");

/**
 * BASIC INPUT VALIDATION
 */
const validateCouponInput = (req, res, next) => {
    const { code } = req.body;

    if (!code || typeof code !== "string" || code.length > 50) {
        return res.status(400).json({
            success: false,
            message: "Invalid coupon code",
        });
    }

    req.body.code = code.trim().toUpperCase();
    next();
};

/**
 * LIGHT PUBLIC RATE LIMIT
 */
const publicLimiter = authLimiter;

/**
 * LIST COUPONS (SAFE PUBLIC)
 */
router.get(
    "/",
    publicLimiter,
    safeHandler(async (req, res) => {
        const data = await listCoupons(req, res);
        if (!res.headersSent) {
            res.json({ success: true, data });
        }
    })
);

/**
 * APPLY COUPON (AUTH + PROTECTED)
 */
router.post(
    "/apply",
    isAuthenticated,
    authLimiter,
    validateCouponInput,
    safeHandler(async (req, res, next) => {
        try {
            const result = await applyCoupon(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.warn("COUPON_APPLY_FAILED", {
                userId: req.user?.id,
                code: req.body.code,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * VALIDATE COUPON (AUTH REQUIRED)
 */
router.post(
    "/validate",
    isAuthenticated,
    authLimiter,
    validateCouponInput,
    safeHandler(async (req, res, next) => {
        try {
            const result = await validateCoupon(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.warn("COUPON_VALIDATE_FAILED", {
                userId: req.user?.id,
                code: req.body.code,
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;