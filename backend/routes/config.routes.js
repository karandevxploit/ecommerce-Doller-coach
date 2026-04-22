const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");
const { logger } = require("../utils/logger");
const configController = require("../controllers/config.controller");
const rateLimit = require("express-rate-limit");

/**
 * LIGHT RATE LIMIT (PUBLIC ENDPOINT)
 */
const configLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 120, // 120 requests/min/IP
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * RESPONSE CACHE HEADERS MIDDLEWARE
 */
const cacheHeaders = (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=60"); // browser cache 1 min
    res.setHeader("Surrogate-Control", "max-age=300"); // CDN cache 5 min
    next();
};

/**
 * FAIL-SAFE WRAPPER
 */
const safeConfigHandler = async (req, res, next) => {
    try {
        const data = await configController.getConfig(req, res);

        if (!res.headersSent) {
            res.json({
                success: true,
                data,
            });
        }
    } catch (err) {
        logger.error("CONFIG_FETCH_FAILED", {
            error: err.message,
        });

        // Graceful fallback (never break homepage)
        return res.status(200).json({
            success: true,
            data: {
                company_name: "Default",
                phone: "",
                email: "",
                address: "",
            },
            fallback: true,
        });
    }
};

/**
 * @route   GET /api/config
 * @desc    Get public configuration (cached + fail-safe)
 * @access  Public
 */
router.get("/", configLimiter, cacheHeaders, safeHandler(safeConfigHandler));

module.exports = router;