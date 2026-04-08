const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, default: "" },
    link: { type: String, default: "" },
    couponCode: { type: String, default: "", uppercase: true, trim: true, index: true },
    discountType: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    discountValue: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: null },
    applyTo: { type: String, enum: ["all", "category", "product"], default: "all" },
    applyToCategory: { type: String, default: "", trim: true },
    applyToProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    usageLimit: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    priority: { type: Number, default: 1, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

