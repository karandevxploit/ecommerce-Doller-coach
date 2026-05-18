const router = require("express").Router();
const mongoose = require("mongoose");
const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require("../controllers/category.controller");

const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (id && !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ success: false, data: null, message: "Invalid category ID" });
  }
  return next();
};

router.get("/", authLimiter, safeHandler(listCategories));

router.post("/", protect, authorize("admin"), authLimiter, safeHandler(createCategory));
router.put("/:id", protect, authorize("admin"), authLimiter, validateObjectId, safeHandler(updateCategory));
router.delete("/:id", protect, authorize("admin"), authLimiter, validateObjectId, safeHandler(deleteCategory));

module.exports = router;
