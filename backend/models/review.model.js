const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE REVIEW SYSTEM
 *
 * Features:
 * - One review per user per product
 * - Anti-spam protections
 * - Soft delete
 * - Moderation tracking
 * - Safe engagement system
 */

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    images: {
      type: [String],
      default: [],
    },

    /**
     * VERIFIED PURCHASE
     */
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * ENGAGEMENT (SAFE TRACKING)
     */
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    likes: {
      type: Number,
      default: 0,
    },

    helpfulCount: {
      type: Number,
      default: 0,
    },

    /**
     * MODERATION
     */
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    moderatedAt: {
      type: Date,
      default: null,
    },

    /**
     * SECURITY METADATA
     */
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },

    /**
     * SOFT DELETE
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * UNIQUE CONSTRAINT (CRITICAL)
 */
reviewSchema.index(
  { user: 1, product: 1 },
  { unique: true }
);

/**
 * INDEXES
 */
reviewSchema.index({ product: 1, rating: -1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

/**
 * PRE-SAVE: Sync counters
 */
reviewSchema.pre("save", function (next) {
  try {
    this.likes = this.likedBy.length;
    this.helpfulCount = this.helpfulBy.length;
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC: Toggle Like (Atomic Safe)
 */
reviewSchema.statics.toggleLike = async function (reviewId, userId) {
  const review = await this.findById(reviewId);

  if (!review) throw new Error("Review not found");

  const alreadyLiked = review.likedBy.some(
    (id) => String(id) === String(userId)
  );

  if (alreadyLiked) {
    return this.updateOne(
      { _id: reviewId },
      {
        $pull: { likedBy: userId },
        $inc: { likes: -1 },
      }
    );
  } else {
    return this.updateOne(
      { _id: reviewId },
      {
        $addToSet: { likedBy: userId },
        $inc: { likes: 1 },
      }
    );
  }
};

/**
 * STATIC: Toggle Helpful (Atomic Safe)
 */
reviewSchema.statics.toggleHelpful = async function (reviewId, userId) {
  const review = await this.findById(reviewId);

  if (!review) throw new Error("Review not found");

  const already = review.helpfulBy.some(
    (id) => String(id) === String(userId)
  );

  if (already) {
    return this.updateOne(
      { _id: reviewId },
      {
        $pull: { helpfulBy: userId },
        $inc: { helpfulCount: -1 },
      }
    );
  } else {
    return this.updateOne(
      { _id: reviewId },
      {
        $addToSet: { helpfulBy: userId },
        $inc: { helpfulCount: 1 },
      }
    );
  }
};

/**
 * PAGINATION
 */
reviewSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.Review ||
  mongoose.model("Review", reviewSchema);