const router = require("express").Router();
const { protect } = require("../middlewares/auth.middleware");
const { getWishlist, addToWishlist, removeFromWishlist } = require("../controllers/wishlist.controller");

router.get("/", protect, getWishlist);
router.post("/", protect, addToWishlist);
router.delete("/:productId", protect, removeFromWishlist);

module.exports = router;

