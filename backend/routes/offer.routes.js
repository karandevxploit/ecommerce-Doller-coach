const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");

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
    safeHandler(getActiveOffers)
);

/**
 * CREATE OFFER (ADMIN ONLY)
 */
router.post(
    "/",
    protect,
    authorize("admin"),
    authLimiter,
    safeHandler(createOffer)
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
    safeHandler(updateOffer)
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
    safeHandler(deleteOffer)
);

module.exports = router;