const router = require("express").Router();
const { protect } = require("../middlewares/auth.middleware");
const { getCart, addToCart, updateCartItem, removeCartItem } = require("../controllers/cart.controller");

router.get("/", protect, getCart);
router.post("/", protect, addToCart);
router.put("/", protect, updateCartItem);
router.delete("/:productId", protect, removeCartItem);

module.exports = router;

