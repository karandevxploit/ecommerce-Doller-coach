const router = require("express").Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { upload } = require("../middlewares/upload.middleware");
const { cacheRoute, clearCache } = require("../middlewares/cache.middleware");
const { listProducts, getProduct, createProduct, updateProduct, deleteProduct } = require("../controllers/product.controller");
const validateRequest = require("../middlewares/validateRequest");
const { productSchema } = require("../validations/product.schema");

// Invalidate cache on mutations
router.get("/", cacheRoute(600), listProducts); // Extended TTL for public listings
router.get("/:id", cacheRoute(300), getProduct);
router.post("/", protect, authorize("admin"), upload.single("image"), validateRequest(productSchema), createProduct);
router.put("/:id", protect, authorize("admin"), upload.single("image"), updateProduct);
router.delete("/:id", protect, authorize("admin"), deleteProduct);

module.exports = router;

