const mongoose = require("mongoose");

/**
 * ENTERPRISE CART SCHEMA
 */

const MAX_CART_ITEMS = 50;

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 20, 
      default: 1,
    },
    size: { type: String, default: "", trim: true },
    topSize: { type: String, default: "", trim: true },
    bottomSize: { type: String, default: "", trim: true },
    color: { type: String, default: "", trim: true },
    variantIdx: { type: Number, default: null },
    variantKey: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: {
      type: [cartItemSchema],
      validate: {
        validator: function (val) {
          return val.length <= MAX_CART_ITEMS;
        },
        message: `Cart cannot exceed ${MAX_CART_ITEMS} items`,
      },
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
cartSchema.index({ userId: 1, updatedAt: -1 });
cartSchema.index({ "items.productId": 1, userId: 1 });
cartSchema.index({ "items.variantKey": 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * PRE-VALIDATE: Generate variantKey
 */
cartItemSchema.pre("validate", function (next) {
  try {
    const keyParts = [
      this.productId,
      this.size,
      this.topSize,
      this.bottomSize,
      this.color,
      this.variantIdx,
    ];
    this.variantKey = keyParts.map(v => v || "").join("|").toLowerCase();
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC METHODS
 */
cartSchema.statics.addOrUpdateItem = async function (userId, item) {
  const variantKey = [
    item.productId,
    item.size || "",
    item.topSize || "",
    item.bottomSize || "",
    item.color || "",
    item.variantIdx || "",
  ]
    .join("|")
    .toLowerCase();

  return this.findOneAndUpdate(
    { userId, "items.variantKey": variantKey },
    {
      $inc: { "items.$.quantity": item.quantity || 1 },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  ).then(async (doc) => {
    if (doc) return doc;
    return this.findOneAndUpdate(
      { userId },
      {
        $push: { items: { ...item, variantKey } },
        $set: { updatedAt: new Date() },
      },
      { new: true, upsert: true }
    );
  });
};

cartSchema.statics.clearCart = function (userId) {
  return this.updateOne({ userId }, { $set: { items: [] } });
};

module.exports =
  mongoose.models.Cart ||
  mongoose.model("Cart", cartSchema);