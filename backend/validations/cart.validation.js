const { z } = require("zod");

/**
 * PRODUCTION-GRADE CART VALIDATION
 * Strictly typed schema for cart operations.
 */

const cartItemSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID pulse"),
  quantity: z.number().int().min(1).max(50),
  size: z.string().optional().default(""),
  topSize: z.string().optional().default(""),
  bottomSize: z.string().optional().default(""),
  color: z.string().optional().default(""),
  variantIdx: z.number().int().nullable().optional()
});

exports.addToCartSchema = z.object({
  body: cartItemSchema
});

exports.updateCartSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID pulse"),
    quantity: z.number().int().min(1).max(50),
    size: z.string().optional(),
    color: z.string().optional()
  })
});
