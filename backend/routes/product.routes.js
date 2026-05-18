const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { upload, mediaUpload } = require("../middlewares/upload.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");

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
    safeHandler(listProducts)
);

router.get(
    "/hot-sale",
    authLimiter,
    safeHandler(async (req, res) => {
        const { getHotSale } = require("../controllers/product.controller");
        await getHotSale(req, res);
    })
);

router.get(
    "/new-arrivals",
    authLimiter,
    safeHandler(async (req, res) => {
        const { getNewArrivals } = require("../controllers/product.controller");
        await getNewArrivals(req, res);
    })
);

router.get(
    "/trending",
    authLimiter,
    safeHandler(async (req, res) => {
        const { getTrending } = require("../controllers/product.controller");
        await getTrending(req, res);
    })
);

router.get(
    "/best-sellers",
    authLimiter,
    safeHandler(async (req, res) => {
        const { getBestSellers } = require("../controllers/product.controller");
        await getBestSellers(req, res);
    })
);

router.get(
    "/filters",
    authLimiter,
    safeHandler(getFilters)
);

router.get(
    "/:id",
    authLimiter,
    validateObjectId,
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
    safeHandler(createProduct)
);

router.put(
    "/:id",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    clearCache("products"),
    safeHandler(updateProduct)
);

router.delete(
    "/:id/video",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    clearCache("products"),
    safeHandler(async (req, res) => {
        const { deleteVideo } = require("../controllers/product.controller");
        await deleteVideo(req, res);
    })
);

router.delete(
    "/:id",
    protect,
    authorize("admin"),
    authLimiter,
    validateObjectId,
    clearCache("products"),
    safeHandler(deleteProduct)
);

module.exports = router;
