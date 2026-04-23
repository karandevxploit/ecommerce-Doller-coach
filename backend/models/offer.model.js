const mongoose = require("mongoose");

/**
 * ENTERPRISE OFFER SCHEMA
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
    applyTo: {
      type: String,
      enum: ["all", "category", "product"],
      default: "all",
    },
    applyToCategory: {
      type: String,
      default: "",
      trim: true,
    },
    applyToProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    usageLimit: {
      type: Number,
      default: null,
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
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    priority: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerSchema.index({ applyTo: 1, applyToCategory: 1 });
offerSchema.index({ applyToProductId: 1 });
offerSchema.index({ couponCode: 1 });
offerSchema.index({ isDeleted: 1 });
offerSchema.index({ priority: 1 });

/**
 * PRE-SAVE HOOK
 */
offerSchema.pre("save", function (next) {
  try {
    if (this.discountType === "percentage" && this.discountValue > 100) {
      return next(new Error("Percentage discount cannot exceed 100"));
    }
    if (this.startDate > this.endDate) {
      return next(new Error("Invalid date range"));
    }
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
 * STATIC METHODS
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

  if (!offer) throw new Error("Offer not valid");
  if (orderAmount < offer.minOrderAmount) throw new Error("Minimum order not met");

  if (offer.usageLimit !== null && offer.usedCount >= offer.usageLimit) {
    throw new Error("Offer usage limit exceeded");
  }

  const userUsage = offer.usedBy.find((u) => String(u.userId) === String(userId));
  if (offer.perUserLimit !== null && userUsage && userUsage.count >= offer.perUserLimit) {
    throw new Error("User usage limit exceeded");
  }

  let discount = 0;
  if (offer.discountType === "percentage") {
    discount = (orderAmount * offer.discountValue) / 100;
  } else {
    discount = offer.discountValue;
  }
  if (offer.maxDiscount !== null) discount = Math.min(discount, offer.maxDiscount);

  const updated = await this.findOneAndUpdate(
    { _id: offer._id, $or: [{ usageLimit: null }, { usedCount: { $lt: offer.usageLimit } }] },
    { $inc: { usedCount: 1 }, $push: { usedBy: { userId, count: 1 } } },
    { new: true }
  );

  if (!updated) throw new Error("Race condition, try again");
  return { discount, finalAmount: Math.max(orderAmount - discount, 0) };
};

module.exports =
  mongoose.models.Offer ||
  mongoose.model("Offer", offerSchema);