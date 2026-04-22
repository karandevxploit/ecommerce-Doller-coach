const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");

const { isAuthenticated } = require("../middlewares/auth.middleware");
const {
    createPaymentOrder,
    verifyPayment,
    handleWebhook,
} = require("../controllers/payment.controller");

const {
    paymentRateLimit,
    checkFraudBlock,
} = require("../middlewares/fraud.middleware");

const rateLimit = require("express-rate-limit");
const { logger } = require("../utils/logger");

/**
 * WEBHOOK RATE LIMIT (STRICT)
 */
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50, // Razorpay retries safe
});

/**
 * RAW BODY REQUIRED FOR SIGNATURE VERIFICATION
 */
const express = require("express");
const rawBodyParser = express.raw({ type: "application/json", limit: "1mb" });

/**
 * PAYMENT ORDER CREATION
 */
router.post(
    "/create-order",
    isAuthenticated,
    checkFraudBlock,
    paymentRateLimit,
    safeHandler(async (req, res, next) => {
        try {
            const result = await createPaymentOrder(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("PAYMENT_ORDER_CREATE_FAILED", {
                userId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * VERIFY PAYMENT (IDEMPOTENT REQUIRED)
 */
router.post(
    "/verify",
    isAuthenticated,
    checkFraudBlock,
    paymentRateLimit,
    safeHandler(async (req, res, next) => {
        try {
            const result = await verifyPayment(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("PAYMENT_VERIFY_FAILED", {
                userId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * WEBHOOK (CRITICAL ENDPOINT)
 * - Raw body for signature verification
 * - Rate limited
 */
router.post(
    "/webhook",
    webhookLimiter,
    rawBodyParser,
    safeHandler(async (req, res, next) => {
        try {
            await handleWebhook(req, res);

            logger.info("PAYMENT_WEBHOOK_RECEIVED", {
                ip: req.ip,
            });
        } catch (err) {
            logger.error("PAYMENT_WEBHOOK_FAILED", {
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;