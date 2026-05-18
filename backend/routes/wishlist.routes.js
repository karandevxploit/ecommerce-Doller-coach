const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");

const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlist.controller");

const validateProductId = (req, res, next) => {
  const { productId } = req.params;

  if (productId && !mongoose.Types.ObjectId.isValid(String(productId))) {
    return res.status(400).json({
      success: false,
      data: null,
      message: "Invalid product ID",
    });
  }

  return next();
};

router.get("/", protect, authLimiter, safeHandler(getWishlist));
router.post("/", protect, authLimiter, safeHandler(addToWishlist));
router.delete("/:productId", protect, authLimiter, validateProductId, safeHandler(removeFromWishlist));

module.exports = router;
