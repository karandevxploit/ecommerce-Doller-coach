const mongoose = require("mongoose");

/**
 * ENTERPRISE WISHLIST SYSTEM
 */

const MAX_WISHLIST_ITEMS = 100;

const wishlistItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: {
      type: [wishlistItemSchema],
      validate: {
        validator: function (val) {
          return val.length <= MAX_WISHLIST_ITEMS;
        },
        message: `Wishlist cannot exceed ${MAX_WISHLIST_ITEMS} items`,
      },
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
// wishlistSchema.index({ userId: 1 }); // Duplicated by unique: true on field
wishlistSchema.index({ "items.productId": 1 });
wishlistSchema.index({ "items.addedAt": 1 });

/**
 * STATIC METHODS
 */
wishlistSchema.statics.addItem = async function (userId, productId) {
  return this.findOneAndUpdate(
    { userId, "items.productId": { $ne: productId } },
    { $push: { items: { productId } } },
    { new: true, upsert: true }
  );
};

wishlistSchema.statics.removeItem = function (userId, productId) {
  return this.updateOne({ userId }, { $pull: { items: { productId } } });
};

wishlistSchema.statics.toggleItem = async function (userId, productId) {
  const doc = await this.findOne({ userId });
  if (!doc) {
    return this.create({ userId, items: [{ productId }] });
  }
  const exists = doc.items.some((i) => String(i.productId) === String(productId));
  if (exists) {
    return this.updateOne({ userId }, { $pull: { items: { productId } } });
  } else {
    return this.updateOne({ userId }, { $push: { items: { productId } } });
  }
};

module.exports =
  mongoose.models.Wishlist ||
  mongoose.model("Wishlist", wishlistSchema);