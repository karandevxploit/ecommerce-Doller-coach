const mongoose = require("mongoose");

/**
 * ENTERPRISE COUPON SCHEMA
 *
 * Features:
 * - Atomic usage control
 * - Per-user usage tracking
 * - Strict validation
 * - Optimized indexing
 * - Soft delete
 */

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
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
     * UNIFIED VALIDITY WINDOW
     */
    validFrom: {
      type: Date,
      default: null,
      index: true,
    },

    validTill: {
      type: Date,
      required: true,
      index: true,
    },

    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * PER USER USAGE TRACKING
     */
    usedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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
  },
  { timestamps: true }
);

/**
 * INDEXES
 */
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ validTill: 1, isActive: 1 });
couponSchema.index({ usedCount: 1 });

/**
 * VALIDATION HOOK
 */
couponSchema.pre("save", function (next) {
  try {
    // Percentage validation
    if (this.discountType === "percentage") {
      if (this.discountValue > 100) {
        return next(new Error("Percentage discount cannot exceed 100"));
      }
    }

    // Date validation
    if (this.validFrom && this.validTill) {
      if (this.validFrom > this.validTill) {
        return next(new Error("Invalid date range"));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC: Apply Coupon (Atomic Safe)
 */
couponSchema.statics.applyCoupon = async function ({
  code,
  userId,
  orderAmount,
}) {
  const now = new Date();

  const coupon = await this.findOne({
    code,
    isActive: true,
    isDeleted: false,
    validTill: { $gte: now },
    $or: [{ validFrom: null }, { validFrom: { $lte: now } }],
  });

  if (!coupon) {
    throw new Error("Invalid or expired coupon");
  }

  // Min order check
  if (orderAmount < coupon.minOrderAmount) {
    throw new Error("Order amount too low for this coupon");
  }

  // Usage limit check
  if (
    coupon.usageLimit !== null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    throw new Error("Coupon usage limit exceeded");
  }

  // Per-user check
  const alreadyUsed = coupon.usedBy.some(
    (u) => String(u.userId) === String(userId)
  );

  if (alreadyUsed) {
    throw new Error("Coupon already used by this user");
  }

  // Calculate discount
  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = (orderAmount * coupon.discountValue) / 100;
  } else {
    discount = coupon.discountValue;
  }

  if (coupon.maxDiscount !== null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

  // ATOMIC UPDATE
  const updated = await this.findOneAndUpdate(
    {
      _id: coupon._id,
      $or: [
        { usageLimit: null },
        { usedCount: { $lt: coupon.usageLimit } },
      ],
    },
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: { userId } },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("Coupon race condition detected, try again");
  }

  return {
    discount,
    finalAmount: Math.max(orderAmount - discount, 0),
  };
};

module.exports =
  mongoose.models.Coupon ||
  mongoose.model("Coupon", couponSchema);