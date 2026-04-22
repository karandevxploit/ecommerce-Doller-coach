const router = require("express").Router();
const { logger } = require("../utils/logger");

/**
 * DEPRECATED ROUTER
 * This route has been removed and should not be used.
 * Keeping for backward compatibility tracking.
 */
router.all("*", (req, res) => {
    logger.warn("DEPRECATED_ROUTE_HIT", {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });

    return res.status(410).json({
        success: false,
        message: "This endpoint has been removed. Please update your client.",
    });
});

module.exports = router;