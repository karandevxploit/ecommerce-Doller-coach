const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);

