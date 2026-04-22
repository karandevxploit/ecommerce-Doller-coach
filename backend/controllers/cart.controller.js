const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Cart = require("../models/cart.model");
const Product = require("../models/product.model");

const { ok, fail } = require("../utils/apiResponse");
const { updateCartSchema, addToCartSchema } = require("../validations/cart.validation");

// ===============================
// GET CART (OPTIMIZED)
// ===============================
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id })
    .populate("items.productId", "title price images stock")
    .lean();

  return ok(res, cart || { userId: req.user._id, items: [] });
});

// ===============================
// ADD TO CART (RACE-SAFE)
// ===============================
exports.addToCart = asyncHandler(async (req, res) => {
  const payload = addToCartSchema.parse(req.body);
  const { productId, quantity, size, color, topSize, bottomSize, variantIdx } = payload;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Check product stock (latest)
    const product = await Product.findById(productId)
      .select("stock title")
      .session(session);

    if (!product) {
      await session.abortTransaction();
      return fail(res, "Product not found", 404);
    }

    if ((product.stock || 0) < quantity) {
      await session.abortTransaction();
      return fail(res, `Only ${product.stock} items left`, 400);
    }

    // 2. Ensure cart exists
    let cart = await Cart.findOne({ userId: req.user._id }).session(session);

    if (!cart) {
      cart = await Cart.create(
        [{ userId: req.user._id, items: [] }],
        { session }
      );
      cart = cart[0];
    }

    // 3. Find existing item
    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId &&
        (item.size || "") === (size || "") &&
        (item.color || "") === (color || "") &&
        (item.topSize || "") === (topSize || "") &&
        (item.bottomSize || "") === (bottomSize || "")
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        size: size || "",
        color: color || "",
        topSize: topSize || "",
        bottomSize: bottomSize || "",
        variantIdx,
      });
    }

    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    return ok(res, cart, "Cart updated");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ===============================
// UPDATE CART ITEM (STRICT)
// ===============================
exports.updateCartItem = asyncHandler(async (req, res) => {
  const payload = updateCartSchema.parse(req.body);
  const { productId, quantity, size, color } = payload;

  if (quantity <= 0) {
    return fail(res, "Invalid quantity", 400);
  }

  const product = await Product.findById(productId).select("stock").lean();

  if (!product || (product.stock || 0) < quantity) {
    return fail(res, "Insufficient stock", 400);
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) return fail(res, "Cart not found", 404);

  const item = cart.items.find(
    (i) =>
      i.productId.toString() === productId &&
      (i.size || "") === (size || "") &&
      (i.color || "") === (color || "")
  );

  if (!item) return fail(res, "Item not found", 404);

  item.quantity = quantity;

  await cart.save();

  return ok(res, cart, "Cart item updated");
});

// ===============================
// REMOVE ITEM (SAFE)
// ===============================
exports.removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { size, color } = req.query;

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) return ok(res, { items: [] });

  cart.items = cart.items.filter(
    (item) =>
      !(
        item.productId.toString() === productId &&
        (!size || item.size === size) &&
        (!color || item.color === color)
      )
  );

  await cart.save();

  return ok(res, cart, "Item removed");
});