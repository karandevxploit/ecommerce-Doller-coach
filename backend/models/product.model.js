const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    brand: { type: String, default: "", trim: true },
    category: { 
      type: String, 
      required: true, 
      enum: ["MEN", "WOMEN"],
      uppercase: true,
      index: true 
    },
    subcategory: { type: String, default: "", trim: true },
    productType: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    shortDescription: { type: String, default: "", trim: true },
    fullDescription: { type: String, default: "", trim: true },
    images: { type: [String], required: true },
    originalPrice: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, default: "", trim: true },
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    video: { type: String, default: "", trim: true },
    type: { 
      type: String, 
      required: true, 
      enum: ["TOPWEAR", "BOTTOMWEAR", "FULL_OUTFIT"],
      uppercase: true,
      index: true 
    },
    sizes: { 
      type: [String], 
      default: [] 
    },
    topSizes: { 
      type: [String], 
      default: [] 
    },
    bottomSizes: { 
      type: [String], 
      default: [] 
    },
  },
  { timestamps: true }
);

// Dynamic Size Validation
productSchema.pre("save", function (next) {
  const topwearSizes = ["S", "M", "L", "XL", "XXL"];
  const bottomwearSizes = ["28", "30", "32", "34", "36", "38"];

  if (this.type === "TOPWEAR") {
    const invalid = (this.sizes || []).find(s => !topwearSizes.includes(s));
    if (invalid) return next(new Error(`Invalid size for TOPWEAR: ${invalid}`));
  } else if (this.type === "BOTTOMWEAR") {
    const invalid = (this.sizes || []).find(s => !bottomwearSizes.includes(s));
    if (invalid) return next(new Error(`Invalid size for BOTTOMWEAR: ${invalid}`));
  } else if (this.type === "FULL_OUTFIT") {
    const invalidTop = (this.topSizes || []).find(s => !topwearSizes.includes(s));
    const invalidBottom = (this.bottomSizes || []).find(s => !bottomwearSizes.includes(s));
    if (invalidTop) return next(new Error(`Invalid Top size for FULL_OUTFIT: ${invalidTop}`));
    if (invalidBottom) return next(new Error(`Invalid Bottom size for FULL_OUTFIT: ${invalidBottom}`));
  }
  next();
});
productSchema.virtual("name").get(function () {
  return this.title;
});
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, type: 1 });
productSchema.index({ featured: 1, trending: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ productType: 1 });
productSchema.index({ title: "text", description: "text" });

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);

