const router = require("express").Router();
const { isAuthenticated } = require("../middlewares/auth.middleware");
const { createPaymentOrder, verifyPayment, handleWebhook } = require("../controllers/payment.controller");

router.post("/create-order", isAuthenticated, createPaymentOrder);
router.post("/verify", isAuthenticated, verifyPayment);
router.post("/webhook", handleWebhook); // Public, signature-verified

module.exports = router;

