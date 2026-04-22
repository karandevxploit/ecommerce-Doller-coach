const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
} = require("../controllers/cart.controller");

const validate = require("../middlewares/validate.middleware");
const {
    addToCartSchema,
    updateCartSchema,
} = require("../validations/cart.validation");

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
 * CART ROUTES (HARDENED)
 */

// GET CART (read-heavy, still protected)
router.get("/", protect, safeHandler(getCart));

/**
 * ADD TO CART
 * - Rate limited
 * - Validated
 */
router.post(
    "/",
    protect,
    authLimiter,
    validate(addToCartSchema, "body"),
    safeHandler(addToCart)
);

/**
 * UPDATE CART ITEM
 * - Rate limited
 * - Validated
 */
router.put(
    "/",
    protect,
    authLimiter,
    validate(updateCartSchema, "body"),
    safeHandler(updateCartItem)
);

/**
 * REMOVE ITEM
 */
router.delete(
    "/:productId",
    protect,
    authLimiter,
    validateObjectId,
    safeHandler(removeCartItem)
);

/**
 * GLOBAL ERROR LOGGER (OPTIONAL ENHANCEMENT)
 */
router.use((err, req, res, next) => {
    logger.error("CART_ROUTE_ERROR", {
        path: req.originalUrl,
        method: req.method,
        error: err.message,
    });
    next(err);
});

module.exports = router;