const router = require("express").Router();

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");

const {
  getSiteContent,
  updateSiteContent,
  validateSiteContentUpdate,
} = require("../controllers/siteContent.controller");

router.get(
  "/",
  authLimiter,
  cacheRoute(300),
  safeHandler(getSiteContent)
);

router.put(
  "/",
  protect,
  authorize("admin"),
  authLimiter,
  validateSiteContentUpdate,
  clearCache("/api/site-content"),
  safeHandler(updateSiteContent)
);

module.exports = router;
