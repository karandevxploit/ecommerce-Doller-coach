const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");

const {
  createReview,
  getProductReviews,
  adminListReviews,
  approveReview,
  deleteReview,
  markHelpful
} = require("../controllers/review.controller");

/**
 * PUBLIC ROUTES (CACHED)
 */
router.get(
  "/product/:productId",
  authLimiter,
  cacheRoute(300),
  safeHandler(getProductReviews)
);

/**
 * AUTHENTICATED ROUTES
 */
router.post(
  "/",
  protect,
  authLimiter,
  clearCache("products"),
  safeHandler(createReview)
);

router.put(
  "/:reviewId/helpful",
  protect,
  authLimiter,
  safeHandler(markHelpful)
);

/**
 * ADMIN ROUTES
 */
router.get(
  "/admin",
  protect,
  authorize("admin"),
  safeHandler(adminListReviews)
);

router.put(
  "/admin/:id/approve",
  protect,
  authorize("admin"),
  clearCache("products"),
  safeHandler(approveReview)
);

router.delete(
  "/admin/:id",
  protect,
  authorize("admin"),
  clearCache("products"),
  safeHandler(deleteReview)
);

module.exports = router;