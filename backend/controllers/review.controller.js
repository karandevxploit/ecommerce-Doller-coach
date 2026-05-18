const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Review = require("../models/review.model");
const Product = require("../models/product.model");

const cache = require("../services/cache.service");
const { invalidateCache } = require("../middlewares/cache.middleware");
const { ok, fail } = require("../utils/apiResponse");

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const normalizeStatus = (status = "pending") => String(status || "pending").toLowerCase();

const serializeReview = (review = {}) => {
  const product = review.productId || review.product || null;

  return {
    ...review,
    id: String(review._id || review.id || ""),
    product,
    productId: product?._id || product?.id || product || "",
    userName: review.user?.name || review.userName || "User",
    productName: product?.name || product?.title || review.productName || "",
    status: normalizeStatus(review.status),
  };
};

const invalidateReviewCaches = async (productId) => {
  await Promise.allSettled([
    cache.del(`reviews:${productId}`),
    invalidateCache("/api/reviews"),
    invalidateCache("/api/products"),
  ]);
};

const recalculateProductRating = async (productId) => {
  if (!isObjectId(productId)) return { average: 0, count: 0 };

  const pid = new mongoose.Types.ObjectId(productId);
  const productMatch = { $or: [{ productId: pid }, { product: pid }] };

  const [stats] = await Review.aggregate([
    {
      $match: {
        ...productMatch,
        status: "approved",
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$productId",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const average = Number((stats?.average || 0).toFixed(1));
  const count = stats?.count || 0;

  await Product.updateOne(
    { _id: pid },
    {
      $set: {
        rating: average,
        "ratings.average": average,
        "ratings.count": count,
      },
    }
  );

  return { average, count };
};

// ===============================
// CREATE REVIEW
// ===============================
exports.createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment, images = [] } = req.body || {};
  const userId = req.user?._id;
  const numericRating = Number(rating);
  const cleanComment = String(comment || "").trim();

  if (!userId) return fail(res, "Authentication required", 401);
  if (!isObjectId(productId)) return fail(res, "Invalid product", 400);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return fail(res, "Rating must be between 1-5", 400);
  }
  if (!cleanComment) return fail(res, "Review comment is required", 400);
  if (cleanComment.length > 1000) return fail(res, "Review comment is too long", 400);

  const product = await Product.findOne({
    _id: productId,
    isDeleted: { $ne: true },
    status: { $ne: "archived" },
  }).select("_id").lean();

  if (!product) return fail(res, "Product not found", 404);

  const existing = await Review.findOne({
    user: userId,
    isDeleted: { $ne: true },
    $or: [{ productId }, { product: productId }],
  }).lean();

  if (existing) {
    return fail(res, "You have already reviewed this product", 409);
  }

  const safeImages = Array.isArray(images)
    ? images.map((url) => String(url || "").trim()).filter(Boolean).slice(0, 5)
    : [];

  const review = await Review.create({
    productId,
    product: productId,
    user: userId,
    rating: numericRating,
    comment: cleanComment,
    images: safeImages,
    status: "pending",
    ip: req.ip || null,
    userAgent: req.get?.("user-agent") || null,
  });

  await invalidateReviewCaches(productId);

  return ok(res, serializeReview(review.toObject()), "Review submitted", 201);
});

// ===============================
// GET PRODUCT REVIEWS
// ===============================
exports.getProductReviews = asyncHandler(async (req, res) => {
  const productId = req.params.productId || req.params.id;

  if (!isObjectId(productId)) {
    return ok(
      res,
      { reviews: [], totalReviews: 0, avgRating: 0, averageRating: 0 },
      "Reviews fetched"
    );
  }

  const cacheKey = `reviews:${productId}`;
  const payload = await cache.getOrSet(
    cacheKey,
    async () => {
      const pid = new mongoose.Types.ObjectId(productId);

      const [reviews, stats] = await Promise.all([
        Review.find({
          $or: [{ productId: pid }, { product: pid }],
          status: "approved",
          isDeleted: { $ne: true },
        })
          .select("rating comment images createdAt helpfulCount user productId")
          .populate("user", "name")
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        Review.aggregate([
          {
            $match: {
              $or: [{ productId: pid }, { product: pid }],
              status: "approved",
              isDeleted: { $ne: true },
            },
          },
          {
            $group: {
              _id: null,
              avgRating: { $avg: "$rating" },
              totalReviews: { $sum: 1 },
            },
          },
        ]),
      ]);

      const totalReviews = stats[0]?.totalReviews || 0;
      const avgRating = Number((stats[0]?.avgRating || 0).toFixed(1));

      return {
        reviews: reviews.map(serializeReview),
        totalReviews,
        avgRating,
        averageRating: avgRating,
      };
    },
    60
  );

  return ok(res, payload, "Reviews fetched");
});

// ===============================
// ADMIN LIST
// ===============================
exports.adminListReviews = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const sortBy = req.query.sortBy === "oldest" ? 1 : -1;
  const status = normalizeStatus(req.query.status || "");
  const query = { isDeleted: { $ne: true } };

  if (["pending", "approved", "rejected"].includes(status)) {
    query.status = status;
  }

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("user", "name email")
      .populate("productId", "name title")
      .populate("product", "name title")
      .sort({ createdAt: sortBy })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ]);

  const data = reviews.map(serializeReview);

  return ok(res, data, "Reviews fetched", 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  });
});

// ===============================
// APPROVE REVIEW
// ===============================
exports.approveReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return fail(res, "Invalid review ID", 400);

  const updatedReview = await Review.findOneAndUpdate(
    {
      _id: id,
      isDeleted: { $ne: true },
      status: { $ne: "approved" },
    },
    {
      $set: {
        status: "approved",
        moderatedBy: req.user?._id || null,
        moderatedAt: new Date(),
      },
    },
    { new: true }
  );

  const review = updatedReview
    ? await Review.findOne({ _id: id, isDeleted: { $ne: true } })
    .populate("user", "name email")
    .populate("productId", "name title")
    .populate("product", "name title")
      .lean()
    : null;

  if (!review) {
    const existing = await Review.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate("user", "name email")
      .populate("productId", "name title")
      .populate("product", "name title")
      .lean();

    if (!existing) return fail(res, "Review not found", 404);
    return ok(res, serializeReview(existing), "Already approved");
  }

  await Promise.allSettled([
    recalculateProductRating(review.productId?._id || review.productId || review.product?._id || review.product),
    invalidateReviewCaches(review.productId?._id || review.productId || review.product?._id || review.product),
  ]);

  return ok(res, serializeReview(review), "Review approved");
});

// ===============================
// DELETE REVIEW
// ===============================
exports.deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return fail(res, "Invalid review ID", 400);

  const review = await Review.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    {
      $set: {
        isDeleted: true,
        status: "rejected",
        moderatedBy: req.user?._id || null,
        moderatedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  if (!review) return fail(res, "Review not found", 404);

  await Promise.allSettled([
    recalculateProductRating(review.productId || review.product),
    invalidateReviewCaches(review.productId || review.product),
  ]);

  return ok(res, { deleted: true }, "Review deleted");
});

// ===============================
// MARK HELPFUL
// ===============================
exports.markHelpful = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  if (!isObjectId(reviewId)) return fail(res, "Invalid review ID", 400);
  if (!req.user?._id) return fail(res, "Authentication required", 401);

  const result = await Review.toggleHelpful(reviewId, req.user._id);
  const updated = await Review.findById(reviewId).select("helpfulCount helpfulBy").lean();

  if (!result?.modifiedCount) {
    return fail(res, "Unable to update helpful vote", 409);
  }

  return ok(
    res,
    {
      helpfulCount: updated?.helpfulCount || 0,
      marked: Boolean(updated?.helpfulBy?.some((id) => String(id) === String(req.user._id))),
    },
    "Helpful vote updated"
  );
});
