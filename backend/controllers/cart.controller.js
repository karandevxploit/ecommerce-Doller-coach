const asyncHandler = require("express-async-handler");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const { ok, fail } = require("../utils/apiResponse");

function parsePositiveInt(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < 1) return fallback;
  return i;
}

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate("items.productId").lean();
  return ok(res, cart || { userId: req.user._id, items: [] }, "Cart fetched");
});

exports.addToCart = asyncHandler(async (req, res) => {
  const { productId, size } = req.body || {};
  const quantity = parsePositiveInt(req.body?.quantity, 1);
  if (!productId || !mongoose.isValidObjectId(productId)) {
    return fail(res, "Invalid productId", 400);
  }

  const product = await Product.findById(productId).select("stock").lean();
  if (!product) return fail(res, "Product not found", 404);
  if ((product.stock ?? 0) < 1) return fail(res, "Out of stock", 400);

  let cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) cart = await Cart.create({ userId: req.user._id, items: [] });
  const idx = cart.items.findIndex((it) => String(it.productId) === String(productId) && it.size === (size || ""));
  if (idx >= 0) {
    const nextQty = (cart.items[idx].quantity || 0) + quantity;
    if (nextQty > (product.stock ?? 0)) {
      return res.status(400).json({ message: "Insufficient stock" });
    }
    cart.items[idx].quantity = nextQty;
  } else {
    if (quantity > (product.stock ?? 0)) {
      return res.status(400).json({ message: "Insufficient stock" });
    }
    cart.items.push({ productId, quantity, size: size || "" });
  }
  await cart.save();
  return ok(res, cart, "Product added to cart");
});

exports.updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.body || {};
  const nextQty = parsePositiveInt(req.body?.quantity, null);
  if (!productId || !mongoose.isValidObjectId(productId)) {
    return fail(res, "Invalid productId", 400);
  }
  if (nextQty === null) return fail(res, "Invalid quantity", 400);

  const product = await Product.findById(productId).select("stock").lean();
  if (!product) return fail(res, "Product not found", 404);
  if (nextQty > (product.stock ?? 0)) return fail(res, "Insufficient stock", 400);

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) return fail(res, "Cart not found", 404);
  const item = cart.items.find((it) => String(it.productId) === String(productId));
  if (!item) return fail(res, "Cart item not found", 404);
  item.quantity = nextQty;
  await cart.save();
  return ok(res, cart, "Cart item updated");
});

exports.removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) return ok(res, { removed: true }, "Item removed");
  cart.items = cart.items.filter((it) => String(it.productId) !== String(productId));
  await cart.save();
  return ok(res, cart, "Item removed from cart");
});

