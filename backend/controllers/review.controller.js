const asyncHandler = require("express-async-handler");
const Review = require("../models/review.model");
const Product = require("../models/product.model");

// Recalculate average rating for a product
const updateProductRating = async (productId) => {
  const reviews = await Review.find({ product: productId, status: "approved" });
  const numReviews = reviews.length;
  const rating = numReviews > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / numReviews 
    : 0;

  await Product.findByIdAndUpdate(productId, { rating, numReviews });
};

exports.addReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment } = req.body;

  if (!productId || !rating || !comment) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const review = await Review.create({
    user: req.user._id,
    product: productId,
    rating,
    comment,
    status: "pending",
  });

  res.status(201).json({ message: "Review submitted for moderation", review });
});

exports.getReviewsByProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const mongoose = require("mongoose");
  
  try {
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
       return res.json([]);
    }

    const reviews = await Review.find({ 
      product: productId, 
      status: "approved" 
    }).populate("user", "name").sort({ createdAt: -1 });
    
    res.json(reviews || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: List all reviews
exports.adminListReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate("user", "name email")
    .populate("product", "title")
    .sort({ createdAt: -1 });
  res.json(reviews);
});

// ADMIN: Approve a review
exports.approveReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id, 
    { status: "approved" }, 
    { new: true }
  );
  
  if (!review) return res.status(404).json({ message: "Review not found" });

  await updateProductRating(review.product);
  res.json({ message: "Review approved", review });
});

// ADMIN: Delete a review
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });

  await updateProductRating(review.product);
  res.json({ message: "Review deleted" });
});
