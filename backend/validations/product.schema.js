const { z } = require("zod");

const sanitize = (val) => val ? val.replace(/<[^>]*>?/gm, "").trim() : "";

const productSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name too short").max(250),
    description: z.string().optional(),
    
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().optional(),
    productType: z.string().optional(),
    
    price: z.number().nonnegative("Price must be >= 0"),
    originalPrice: z.number().nonnegative().optional(),
    
    images: z.array(z.string()).optional().default([]),
    primaryImage: z.string().optional(),
    hoverImage: z.string().optional(),

    variants: z.array(z.object({
      sku: z.string().optional(),
      color: z.string().optional(),
      size: z.string().optional(),
      price: z.number().nonnegative(),
      stock: z.number().int().nonnegative()
    }).passthrough()).optional().default([]),

    status: z.enum(["draft", "active", "out_of_stock", "archived"]).optional().default("draft"),
    featured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    trending: z.boolean().optional(),
    stock: z.number().nonnegative().optional(),
    
    badge: z.any().optional(),
    offer: z.any().optional(),
    controls: z.any().optional(),
  }).passthrough(),
});

module.exports = { productSchema };
