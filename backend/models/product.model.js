const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE PRODUCT SCHEMA
 *
 * Features:
 * - Variant-level inventory
 * - SEO slug
 * - Safe pricing model
 * - Soft delete
 * - Better indexing
 */

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, index: true },

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
    name: { type: String, required: true, trim: true, index: true },

    slug: {
      type: String,
      index: true,
      // handled via pre-save hook for better UX
    },

    category: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    subcategory: { type: String, trim: true, lowercase: true },

    description: { type: String, default: "", trim: true },

    tags: { type: [String], default: [], index: true },

    /**
     * MEDIA
     */
    images: { type: [String], default: [] },
    primaryImage: { type: String, default: "" },
    hoverImage: { type: String, default: "" },

    /**
     * PRICING
     */
    originalPrice: { type: Number, min: 0 },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0 },

    /**
     * VARIANTS (CRITICAL UPGRADE)
     */
    variants: [variantSchema],

    /**
     * INVENTORY (fallback if no variants)
     */
    stock: { type: Number, default: 0, min: 0 },

    /**
     * STATUS
     */
    status: {
      type: String,
      enum: ["draft", "active", "out_of_stock", "archived"],
      default: "draft",
      index: true,
    },

    /**
     * FLAGS
     */
    featured: { type: Boolean, default: false, index: true },
    isTrending: { type: Boolean, default: false, index: true },
    isBestSeller: { type: Boolean, default: false, index: true },

    /**
     * RATINGS
     */
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },

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
 * PRE-SAVE HOOK
 */
productSchema.pre("save", async function (next) {
  try {
    // Generate unique slug
    if (!this.slug && this.name) {
      let baseSlug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check collision
      const existing = await mongoose.models.Product.findOne({ slug: baseSlug });
      if (existing && existing._id.toString() !== this._id.toString()) {
        this.slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
      } else {
        this.slug = baseSlug;
      }
    }

    // Pricing logic
    if (this.originalPrice && this.price) {
      this.discountPercent =
        ((this.originalPrice - this.price) / this.originalPrice) * 100;
    }

    // Auto status
    if (this.stock === 0 && (!this.variants || this.variants.length === 0)) {
      this.status = "out_of_stock";
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * INDEXES
 */
productSchema.index({ category: 1, subcategory: 1, productType: 1, price: 1 });
productSchema.index({ isTrending: 1, featured: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ "variants.sku": 1 });
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