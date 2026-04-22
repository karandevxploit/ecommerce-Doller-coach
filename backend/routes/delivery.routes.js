const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { logger } = require("../utils/logger");
const rateLimit = require("express-rate-limit");

const deliveryController = require("../controllers/delivery.controller");

/**
 * RATE LIMIT (PUBLIC ENDPOINT)
 */
const deliveryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * PINCODE VALIDATION
 */
const validatePincode = (req, res, next) => {
    const { pincode } = req.params;

    if (!pincode || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({
            success: false,
            message: "Invalid pincode format",
        });
    }

    next();
};

/**
 * CACHE HEADERS
 */
const cacheHeaders = (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 min
    next();
};

/**
 * FAIL-SAFE WRAPPER
 */
const safeDeliveryHandler = async (req, res, next) => {
    try {
        const result = await deliveryController.checkETA(req, res);

        if (!res.headersSent) {
            res.json({
                success: true,
                data: result,
            });
        }
    } catch (err) {
        logger.error("DELIVERY_CHECK_FAILED", {
            pincode: req.params.pincode,
            error: err.message,
        });

        // Graceful fallback
        return res.status(200).json({
            success: true,
            data: {
                available: false,
                message: "Delivery info temporarily unavailable",
            },
            fallback: true,
        });
    }
};

/**
 * @route   GET /api/delivery/check/:pincode
 * @desc    Check estimated delivery date (Hardened)
 * @access  Public
 */
router.get(
    "/check/:pincode",
    deliveryLimiter,
    validatePincode,
    cacheHeaders,
    safeHandler(safeDeliveryHandler)
);

module.exports = router;