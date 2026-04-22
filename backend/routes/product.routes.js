const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { upload } = require("../middlewares/upload.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getFilters,
} = require("../controllers/product.controller");

const validate = require("../middlewares/validate.middleware");
const { productSchema } = require("../validations/product.schema");

/**
 * PARAM VALIDATION
 */
const validateObjectId = (req, res, next) => {
    if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid product ID",
        });
    }
    next();
};

/**
 * PUBLIC ROUTES (RATE LIMITED + CACHED)
 */
router.get(
    "/",
    authLimiter,
    cacheRoute(600),
    safeHandler(listProducts)
);

router.get(
    "/filters",
    authLimiter,
    cacheRoute(3600),
    safeHandler(getFilters)
);

router.get(
    "/:id",
    authLimiter,
    validateObjectId,
    cacheRoute(300),
    safeHandler(getProduct)
);

/**
 * ADMIN ROUTES (SECURE + CACHE INVALIDATION)
 */
router.post(
    "/",
    protect,
    authorize("admin"),
    authLimiter,
    clearCache("products"),
    safeHandler(async (req, res, next) => {
        try {
            const result = await createProduct(req, res);

            logger.info("PRODUCT_CREATED", {
                adminId: req.user?.id,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("PRODUCT_CREATE_FAILED", {
                adminId: req.user?.id,
                error: err.message,
            });
            next(err);
        }
    })
);

router.put(
    "/:id",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    clearCache("products"),
    safeHandler(async (req, res, next) => {
        try {
            const result = await updateProduct(req, res);

            logger.info("PRODUCT_UPDATED", {
                adminId: req.user?.id,
                productId: req.params.id,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("PRODUCT_UPDATE_FAILED", {
                adminId: req.user?.id,
                productId: req.params.id,
                error: err.message,
            });
            next(err);
        }
    })
);

router.delete(
    "/:id",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    clearCache("products"),
    safeHandler(async (req, res, next) => {
        try {
            const result = await deleteProduct(req, res);

            logger.info("PRODUCT_DELETED", {
                adminId: req.user?.id,
                productId: req.params.id,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("PRODUCT_DELETE_FAILED", {
                adminId: req.user?.id,
                productId: req.params.id,
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;