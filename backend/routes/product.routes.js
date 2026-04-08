const router = require("express").Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { upload } = require("../middlewares/upload.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { listProducts, getProduct, createProduct, updateProduct, deleteProduct } = require("../controllers/product.controller");

// Invalidate cache on mutations
const invalidateCb = (req, res, next) => {
  clearCache();
  next();
};

router.get("/", cacheRoute, listProducts);
router.get("/:id", cacheRoute, getProduct);
router.post("/", protect, authorize("admin"), upload.single("image"), invalidateCb, createProduct);
router.put("/:id", protect, authorize("admin"), upload.single("image"), invalidateCb, updateProduct);
router.delete("/:id", protect, authorize("admin"), invalidateCb, deleteProduct);

module.exports = router;

