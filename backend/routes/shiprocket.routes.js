const router = require("express").Router();
const { handleWebhook } = require("../controllers/shiprocket.controller");
const { safeHandler } = require("../middlewares/error.middleware");

/**
 * PUBLIC WEBHOOK ENDPOINT
 * Shiprocket will POST updates here.
 */
router.post("/webhook", safeHandler(handleWebhook));

module.exports = router;
