const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Wishlist = require("../models/wishlist.model");
const Product = require("../models/product.model");

const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const MAX_ITEMS = 50;
const CACHE_TTL = 300;

// ===============================
// HELPER
// ===============================
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ===============================
// GET WISHLIST (CACHED)
// ===============================
exports.getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const cacheKey = `wishlist:${userId}`;

  // CACHE
  const cached = await safeCall((r) => r.get(cacheKey));
  if (cached) {
    return ok(res, JSON.parse(cached), "Wishlist (cache)");
  }

  const wishlist = await Wishlist.findOne({ userId })
    .populate("items.productId", "title price images stock category")
    .lean();

  const products = (wishlist?.items || [])
    .map((i) => i.productId)
    .filter(Boolean);

  // CACHE SET
  safeCall((r) =>
    r.set(cacheKey, JSON.stringify(products), "EX", CACHE_TTL)
  );

  return ok(res, products, "Wishlist fetched");
});

// ===============================
// ADD TO WISHLIST (SAFE)
// ===============================
exports.addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body || {};
  const userId = req.user._id;

  if (!productId || !isValidId(productId)) {
    return fail(res, "Invalid product ID", 400);
  }

  // Ensure product exists
  const exists = await Product.findById(productId).select("_id").lean();
  if (!exists) {
    return fail(res, "Product not found", 404);
  }

  // Prevent overflow
  const current = await Wishlist.findOne({ userId }).lean();
  if (current?.items?.length >= MAX_ITEMS) {
    return fail(res, "Wishlist limit reached", 400);
  }

  // Atomic update (prevent duplicates by productId)
  await Wishlist.updateOne(
    { userId, "items.productId": { $ne: productId } },
    {
      $push: {
        items: {
          productId,
          addedAt: new Date(),
        },
      },
    },
    { upsert: true }
  );

  // Invalidate cache
  safeCall((r) => r.del(`wishlist:${userId}`));

  return ok(res, { added: true }, "Added to wishlist");
});

// ===============================
// REMOVE FROM WISHLIST
// ===============================
exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  if (!isValidId(productId)) {
    return fail(res, "Invalid product ID", 400);
  }

  await Wishlist.updateOne(
    { userId },
    { $pull: { items: { productId } } }
  );

  // Invalidate cache
  safeCall((r) => r.del(`wishlist:${userId}`));

  return ok(res, { removed: true }, "Removed from wishlist");
});