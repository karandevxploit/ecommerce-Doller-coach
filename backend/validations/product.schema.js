const { z } = require("zod");

const productSchema = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().min(10, "Description must be at least 10 characters"),
    price: z.number().positive("Price must be a positive number"),
    discountPrice: z.number().nonnegative().optional().default(0),
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().optional(),
    productType: z.string().optional(),
    brand: z.string().optional(),
    stock: z.number().int().nonnegative().default(0),
    sizes: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
    featured: z.boolean().optional().default(false),
    trending: z.boolean().optional().default(false),
  }),
});

module.exports = { productSchema };
