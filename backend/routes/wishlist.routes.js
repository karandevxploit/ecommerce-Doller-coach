const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
} = require("../controllers/wishlist.controller");

/**
 * PARAM VALIDATION
 */
const validateObjectId = (req, res, next) => {
    const { productId } = req.params;

    if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid productId",
        });
    }

    next();
};

/**
 * GET WISHLIST (READ)
 */
router.get(
    "/",
    protect,
    authLimiter,
    safeHandler(async (req, res, next) => {
        try {
            const result = await getWishlist(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("WISHLIST_FETCH_FAILED", {
                userId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * ADD TO WISHLIST (SAFE + RATE LIMITED)
 */
router.post(
    "/",
    protect,
    authLimiter,
    safeHandler(async (req, res, next) => {
        try {
            const result = await addToWishlist(req, res);

            logger.info("WISHLIST_ADD", {
                userId: req.user?.id,
                productId: req.body.productId,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("WISHLIST_ADD_FAILED", {
                userId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * REMOVE FROM WISHLIST
 */
router.delete(
    "/:productId",
    protect,
    authLimiter,
    validateObjectId,
    safeHandler(async (req, res, next) => {
        try {
            const result = await removeFromWishlist(req, res);

            logger.info("WISHLIST_REMOVE", {
                userId: req.user?.id,
                productId: req.params.productId,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("WISHLIST_REMOVE_FAILED", {
                userId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;