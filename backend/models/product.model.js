const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE PRODUCT SCHEMA
 */

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true }, // Index moved to schema level
    color: { type: String, default: "", trim: true },
    size: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String },
    category: {
      type: String,
      required: true,
      lowercase: true,
    },
    subcategory: { type: String, trim: true, lowercase: true },
    description: { type: String, default: "", trim: true },
    tags: { type: [String], default: [] },
    images: { type: [String], default: [] },
    primaryImage: { type: String, default: "" },
    hoverImage: { type: String, default: "" },
    video: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      duration: { type: Number },
      size: { type: Number }
    },
    originalPrice: { type: Number, min: 0 },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0 },
    variants: [variantSchema],
    stock: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["draft", "active", "out_of_stock", "archived"],
      default: "draft",
    },
    featured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/**
 * PRE-SAVE HOOK
 */
productSchema.pre("save", async function (next) {
  try {
    if (!this.slug && this.name) {
      let baseSlug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const existing = await mongoose.models.Product.findOne({ slug: baseSlug });
      if (existing && existing._id.toString() !== this._id.toString()) {
        this.slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
      } else {
        this.slug = baseSlug;
      }
    }

    if (this.originalPrice && this.price) {
      this.discountPercent =
        ((this.originalPrice - this.price) / this.originalPrice) * 100;
    }

    if (this.stock === 0 && (!this.variants || this.variants.length === 0)) {
      this.status = "out_of_stock";
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * CONSOLIDATED INDEXES (Production Best Practice)
 * Removes duplicate definitions between field-level and schema-level.
 */
productSchema.index({ name: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isDeleted: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isTrending: 1 });
productSchema.index({ isBestSeller: 1 });
productSchema.index({ "variants.sku": 1 });

// Compound Indexes
productSchema.index({ category: 1, subcategory: 1, productType: 1, price: 1 });
productSchema.index({ isTrending: 1, featured: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });

// Text Search Index
productSchema.index({ name: "text", description: "text", tags: "text" });

/**
 * STATIC: Update Rating (Atomic)
 */
productSchema.statics.updateRating = async function (
  productId,
  newRating
) {
  return this.updateOne(
    { _id: productId },
    {
      $inc: {
        "ratings.count": 1,
        "ratings.average": newRating,
      },
    }
  );
};

productSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.Product ||
  mongoose.model("Product", productSchema);