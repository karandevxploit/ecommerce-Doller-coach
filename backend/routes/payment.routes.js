const router = require("express").Router();
const { isAuthenticated } = require("../middlewares/auth.middleware");
const { createPaymentOrder, verifyPayment, handleWebhook } = require("../controllers/payment.controller");
const { paymentRateLimit, checkFraudBlock } = require("../middlewares/fraud.middleware");

router.post("/create-order", isAuthenticated, checkFraudBlock, paymentRateLimit, createPaymentOrder);
router.post("/verify", isAuthenticated, checkFraudBlock, verifyPayment);
router.post("/webhook", handleWebhook); // Public, signature-verified

module.exports = router;

