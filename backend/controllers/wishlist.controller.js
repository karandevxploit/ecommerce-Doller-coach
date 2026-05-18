const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Wishlist = require("../models/wishlist.model");
const Product = require("../models/product.model");

const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const MAX_ITEMS = 100;
const CACHE_TTL = 300;
const PRODUCT_SELECT =
  "name title slug price originalPrice images primaryImage hoverImage category colors sizes gender stock status offer rating ratings";

const getUserId = (req) => req.user?._id || req.user?.id || req.user?.userId;
const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const cacheKeyFor = (userId) => `wishlist:${userId}`;
const emptyWishlistPayload = () => ({
  items: [],
  products: [],
  count: 0,
});

const invalidateWishlist = async (userId) => {
  await safeCall((r) => r.del(cacheKeyFor(userId)));
};

const serializeProduct = (product = {}) => {
  const id = String(product._id || product.id || product.productId || "");

  return {
    ...product,
    id,
    _id: id,
    title: product.title || product.name || "",
    name: product.name || product.title || "",
    image: product.primaryImage || product.image || product.images?.[0] || "",
  };
};

const extractProducts = (wishlist = {}) => {
  const items = Array.isArray(wishlist?.items) ? wishlist.items : [];

  return items
    .map((item) => item.productId || item.product)
    .filter(Boolean)
    .filter((product) => product.status === "active" && product.isDeleted !== true)
    .map(serializeProduct);
};

const getWishlistDoc = (userId) =>
  Wishlist.findOne({ userId })
    .populate({
      path: "items.productId",
      select: PRODUCT_SELECT,
      populate: { path: "category", select: "name slug" },
    })
    .lean();

// ===============================
// GET WISHLIST
// ===============================
exports.getWishlist = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!isValidId(userId)) return fail(res, "Invalid user", 400);

  const cached = safeJsonParse(await safeCall((r) => r.get(cacheKeyFor(userId))));
  if (cached) {
    return ok(res, cached, "Wishlist fetched");
  }

  const wishlist = await getWishlistDoc(userId);
  if (!wishlist) {
    const payload = emptyWishlistPayload();
    safeCall((r) => r.set(cacheKeyFor(userId), JSON.stringify(payload), "EX", CACHE_TTL));
    return ok(res, payload, "Wishlist fetched");
  }

  const products = extractProducts(wishlist);
  const payload = {
    items: products,
    products,
    count: products.length,
  };

  safeCall((r) => r.set(cacheKeyFor(userId), JSON.stringify(payload), "EX", CACHE_TTL));

  return ok(res, payload, "Wishlist fetched");
});

// ===============================
// ADD TO WISHLIST
// ===============================
exports.addToWishlist = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { productId } = req.body || {};

  if (!isValidId(userId)) return fail(res, "Invalid user", 400);
  if (!isValidId(productId)) return fail(res, "Invalid product ID", 400);

  const product = await Product.findOne({
    _id: productId,
    isDeleted: { $ne: true },
    status: "active",
  })
    .select(PRODUCT_SELECT)
    .populate("category", "name slug")
    .lean();

  if (!product) return fail(res, "Product not found", 404);

  const wishlist = await Wishlist.findOne({ userId }).select("items").lean();
  const alreadyExists = wishlist?.items?.some((item) => String(item.productId) === String(productId));

  if (!alreadyExists && wishlist?.items?.length >= MAX_ITEMS) {
    return fail(res, "Wishlist limit reached", 400);
  }

  if (!alreadyExists) {
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
  }

  await invalidateWishlist(userId);

  logger.info("[WISHLIST_ADD]", { userId: String(userId), productId: String(productId) });

  return ok(
    res,
    {
      added: true,
      alreadyExists: Boolean(alreadyExists),
      product: serializeProduct(product),
      item: serializeProduct(product),
    },
    alreadyExists ? "Already in wishlist" : "Added to wishlist"
  );
});

// ===============================
// REMOVE FROM WISHLIST
// ===============================
exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { productId } = req.params;

  if (!isValidId(userId)) return fail(res, "Invalid user", 400);
  if (!isValidId(productId)) return fail(res, "Invalid product ID", 400);

  const result = await Wishlist.updateOne(
    { userId },
    { $pull: { items: { productId } } }
  );

  await invalidateWishlist(userId);

  logger.info("[WISHLIST_REMOVE]", { userId: String(userId), productId: String(productId) });

  return ok(
    res,
    {
      removed: true,
      productId: String(productId),
      modified: Boolean(result.modifiedCount),
    },
    "Removed from wishlist"
  );
});
