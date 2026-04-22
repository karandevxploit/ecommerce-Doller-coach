const mongoose = require("mongoose");

/**
 * ENTERPRISE OFFER SCHEMA
 *
 * Features:
 * - Atomic usage control
 * - Per-user usage tracking
 * - Strong validation
 * - Targeting safety
 * - Optimized indexing
 * - Soft delete
 */

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    image: { type: String, default: "" },
    link: { type: String, default: "" },

    couponCode: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
      index: true,
    },

    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      default: "percentage",
    },

    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },

    /**
     * TARGETING
     */
    applyTo: {
      type: String,
      enum: ["all", "category", "product"],
      default: "all",
      index: true,
    },

    applyToCategory: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    applyToProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    /**
     * USAGE CONTROL
     */
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
      min: 1,
    },

    perUserLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    usedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        count: {
          type: Number,
          default: 1,
        },
      },
    ],

    /**
     * STATUS
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    startDate: {
      type: Date,
      required: true,
      index: true,
    },

    endDate: {
      type: Date,
      required: true,
      index: true,
    },

    priority: {
      type: Number,
      default: 1,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * INDEXES (FOR SCALE)
 */
offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ applyTo: 1, applyToCategory: 1 });
offerSchema.index({ applyToProductId: 1 });

/**
 * VALIDATION HOOK
 */
offerSchema.pre("save", function (next) {
  try {
    // Discount validation
    if (this.discountType === "percentage" && this.discountValue > 100) {
      return next(new Error("Percentage discount cannot exceed 100"));
    }

    // Date validation
    if (this.startDate > this.endDate) {
      return next(new Error("Invalid date range"));
    }

    // Target validation
    if (this.applyTo === "product" && !this.applyToProductId) {
      return next(new Error("Product ID required for product offer"));
    }

    if (this.applyTo === "category" && !this.applyToCategory) {
      return next(new Error("Category required for category offer"));
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC: Apply Offer (Atomic Safe)
 */
offerSchema.statics.applyOffer = async function ({
  offerId,
  userId,
  orderAmount,
}) {
  const now = new Date();

  const offer = await this.findOne({
    _id: offerId,
    isActive: true,
    isDeleted: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
  });

  if (!offer) {
    throw new Error("Offer not valid");
  }

  if (orderAmount < offer.minOrderAmount) {
    throw new Error("Minimum order not met");
  }

  // Usage limit
  if (
    offer.usageLimit !== null &&
    offer.usedCount >= offer.usageLimit
  ) {
    throw new Error("Offer usage limit exceeded");
  }

  // Per user limit
  const userUsage = offer.usedBy.find(
    (u) => String(u.userId) === String(userId)
  );

  if (
    offer.perUserLimit !== null &&
    userUsage &&
    userUsage.count >= offer.perUserLimit
  ) {
    throw new Error("User usage limit exceeded");
  }

  // Calculate discount
  let discount = 0;

  if (offer.discountType === "percentage") {
    discount = (orderAmount * offer.discountValue) / 100;
  } else {
    discount = offer.discountValue;
  }

  if (offer.maxDiscount !== null) {
    discount = Math.min(discount, offer.maxDiscount);
  }

  // Atomic update
  const updated = await this.findOneAndUpdate(
    {
      _id: offer._id,
      $or: [
        { usageLimit: null },
        { usedCount: { $lt: offer.usageLimit } },
      ],
    },
    {
      $inc: { usedCount: 1 },
      $push: {
        usedBy: { userId, count: 1 },
      },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("Race condition, try again");
  }

  return {
    discount,
    finalAmount: Math.max(orderAmount - discount, 0),
  };
};

module.exports =
  mongoose.models.Offer ||
  mongoose.model("Offer", offerSchema);