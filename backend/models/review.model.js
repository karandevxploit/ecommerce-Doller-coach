const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved"], default: "pending", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Review || mongoose.model("Review", reviewSchema);

