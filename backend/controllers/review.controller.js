const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Review = require("../models/review.model");
const Product = require("../models/product.model");

const { ok, fail } = require("../utils/apiResponse");

// ===============================
// INCREMENTAL RATING UPDATE (FAST)
// ===============================
const updateProductRatingIncremental = async (productId, ratingChange, countChange, session) => {
  const product = await Product.findById(productId).session(session);

  if (!product) return;

  const totalRating = (product.rating || 0) * (product.numReviews || 0);

  const newTotal = totalRating + ratingChange;
  const newCount = (product.numReviews || 0) + countChange;

  const newAvg = newCount > 0 ? newTotal / newCount : 0;

  product.rating = newAvg;
  product.numReviews = newCount;

  await product.save({ session });
};

// ===============================
// CREATE REVIEW (SAFE)
// ===============================
exports.createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment } = req.body;

  if (!productId || !rating || !comment) {
    return fail(res, "All fields required", 400);
  }

  if (rating < 1 || rating > 5) {
    return fail(res, "Rating must be 1-5", 400);
  }

  // Prevent duplicate review per user
  const exists = await Review.findOne({
    user: req.user._id,
    product: productId,
  });

  if (exists) {
    return fail(res, "You already reviewed this product", 409);
  }

  const review = await Review.create({
    user: req.user._id,
    product: productId,
    rating,
    comment,
    status: "pending",
  });

  return ok(res, review, "Review submitted for approval", 201);
});

// ===============================
// GET PRODUCT REVIEWS (OPTIMIZED)
// ===============================
exports.getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return ok(res, []);
  }

  const reviews = await Review.find({
    product: productId,
    status: "approved",
  })
    .select("rating comment helpfulVotes createdAt user")
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return ok(res, reviews);
});

// ===============================
// ADMIN LIST (SECURE)
// ===============================
exports.adminListReviews = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  const data = await Review.find()
    .populate("user", "name email")
    .populate("product", "title")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return ok(res, data);
});

// ===============================
// APPROVE REVIEW (TRANSACTION SAFE)
// ===============================
exports.approveReview = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const review = await Review.findById(req.params.id).session(session);
    if (!review) {
      await session.abortTransaction();
      return fail(res, "Review not found", 404);
    }

    if (review.status === "approved") {
      await session.abortTransaction();
      return ok(res, review, "Already approved");
    }

    review.status = "approved";
    await review.save({ session });

    await updateProductRatingIncremental(
      review.product,
      review.rating,
      1,
      session
    );

    await session.commitTransaction();
    session.endSession();

    return ok(res, review, "Review approved");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ===============================
// DELETE REVIEW (SAFE)
// ===============================
exports.deleteReview = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const review = await Review.findById(req.params.id).session(session);
    if (!review) {
      await session.abortTransaction();
      return fail(res, "Review not found", 404);
    }

    if (review.status === "approved") {
      await updateProductRatingIncremental(
        review.product,
        -review.rating,
        -1,
        session
      );
    }

    await review.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return ok(res, { deleted: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ===============================
// MARK HELPFUL (ANTI-SPAM)
// ===============================
exports.markHelpful = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return fail(res, "Invalid ID", 400);
  }

  // prevent spam: user can vote once
  const updated = await Review.updateOne(
    {
      _id: reviewId,
      helpfulUsers: { $ne: req.user._id },
    },
    {
      $inc: { helpfulVotes: 1 },
      $addToSet: { helpfulUsers: req.user._id },
    }
  );

  if (!updated.modifiedCount) {
    return fail(res, "Already marked helpful", 409);
  }

  return ok(res, { success: true }, "Marked helpful");
});