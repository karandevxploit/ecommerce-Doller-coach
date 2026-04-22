const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    getActiveOffers,
    createOffer,
    updateOffer,
    deleteOffer,
} = require("../controllers/offer.controller");

/**
 * PARAM VALIDATION
 */
const validateObjectId = (req, res, next) => {
    const { id } = req.params;
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid offer ID",
        });
    }
    next();
};

/**
 * LIGHT RATE LIMIT (PUBLIC)
 */
const publicLimiter = authLimiter;

/**
 * GET ACTIVE OFFERS (PUBLIC + CACHED)
 */
router.get(
    "/",
    publicLimiter,
    safeHandler(async (req, res, next) => {
        try {
            const result = await getActiveOffers(req, res);

            if (!res.headersSent) {
                res.setHeader("Cache-Control", "public, max-age=60");
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("OFFERS_FETCH_FAILED", {
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * CREATE OFFER (ADMIN ONLY)
 */
router.post(
    "/",
    protect,
    authorize("admin"),
    authLimiter,
    safeHandler(async (req, res, next) => {
        try {
            const result = await createOffer(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("OFFER_CREATE_FAILED", {
                adminId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * UPDATE OFFER
 */
router.put(
    "/:id",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    safeHandler(async (req, res, next) => {
        try {
            const result = await updateOffer(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("OFFER_UPDATE_FAILED", {
                adminId: req.user?.id,
                offerId: req.params.id,
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * DELETE OFFER (SOFT DELETE RECOMMENDED)
 */
router.delete(
    "/:id",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    safeHandler(async (req, res, next) => {
        try {
            const result = await deleteOffer(req, res);

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("OFFER_DELETE_FAILED", {
                adminId: req.user?.id,
                offerId: req.params.id,
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;