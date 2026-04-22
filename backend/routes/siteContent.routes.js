const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");

const { protect, authorize } = require("../middlewares/auth.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    getSiteContent,
    updateSiteContent,
} = require("../controllers/siteContent.controller");

/**
 * PUBLIC SITE CONTENT (HIGH TRAFFIC → CACHE + LIMIT)
 */
router.get(
    "/",
    authLimiter,
    cacheRoute(600), // 10 min cache
    safeHandler(async (req, res, next) => {
        try {
            const result = await getSiteContent(req, res);

            if (!res.headersSent) {
                res.json({
                    success: true,
                    data: result,
                });
            }
        } catch (err) {
            logger.error("SITE_CONTENT_FETCH_FAILED", {
                error: err.message,
            });

            // FAIL-SAFE (never break homepage)
            return res.status(200).json({
                success: true,
                data: {
                    branding: { logo: { url: "" } },
                    heroCarousel: [],
                    headings: {},
                    banners: {},
                },
                fallback: true,
            });
        }
    })
);

/**
 * UPDATE SITE CONTENT (ADMIN ONLY)
 */
router.put(
    "/",
    protect,
    authorize("admin"),
    authLimiter,
    clearCache("cache:*"),
    safeHandler(async (req, res, next) => {
        try {
            const result = await updateSiteContent(req, res);

            logger.info("SITE_CONTENT_UPDATED", {
                adminId: req.user?.id,
            });

            if (!res.headersSent) {
                res.json({
                    success: true,
                    data: result,
                });
            }
        } catch (err) {
            logger.error("SITE_CONTENT_UPDATE_FAILED", {
                adminId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;