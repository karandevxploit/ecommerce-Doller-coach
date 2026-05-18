const { z } = require("zod");

/**
 * PRODUCTION-GRADE CART VALIDATION
 * Strictly typed schema for cart operations.
 */

const toInt = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number().int().min(1).max(20)
);

const optionalText = z.preprocess(
  (value) => (value == null ? "" : String(value).trim()),
  z.string().max(80).default("")
);

const cartItemSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID"),
  quantity: toInt,
  size: optionalText,
  topSize: optionalText,
  bottomSize: optionalText,
  color: optionalText,
  variantIdx: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().int().min(0).nullable().optional()
  ),
  price: z.number().optional()
}).passthrough(); // Allow unknown fields to prevent 400 on analytics/meta fields

exports.addToCartSchema = cartItemSchema;

exports.updateCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID"),
  quantity: toInt,
  size: optionalText.optional(),
  topSize: optionalText.optional(),
  bottomSize: optionalText.optional(),
  color: optionalText.optional(),
  variantIdx: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().int().min(0).nullable().optional()
  )
}).passthrough();
