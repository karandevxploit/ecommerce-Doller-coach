const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/wishlist.model");

exports.getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user._id }).populate("items.productId").lean();
  const products = (wishlist?.items || []).map((i) => i.productId).filter(Boolean);
  res.json(products);
});

exports.addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ message: "productId is required" });

  let wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (!wishlist) wishlist = await Wishlist.create({ userId: req.user._id, items: [] });

  const already = wishlist.items.some((i) => String(i.productId) === String(productId));
  if (!already) wishlist.items.push({ productId });
  await wishlist.save();

  const updated = await Wishlist.findOne({ userId: req.user._id }).populate("items.productId").lean();
  const products = (updated?.items || []).map((i) => i.productId).filter(Boolean);
  res.json(products);
});

exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!productId) return res.status(400).json({ message: "productId is required" });

  const wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (!wishlist) return res.json([]);

  wishlist.items = wishlist.items.filter((i) => String(i.productId) !== String(productId));
  await wishlist.save();

  const updated = await Wishlist.findOne({ userId: req.user._id }).populate("items.productId").lean();
  const products = (updated?.items || []).map((i) => i.productId).filter(Boolean);
  res.json(products);
});

