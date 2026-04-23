const { z } = require("zod");

/**
 * Sanitization Helper
 * Strips all HTML tags from a string to prevent XSS.
 */
const sanitize = (val) => val.replace(/<[^>]*>?/gm, "").trim();

exports.createReviewSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID signature"),
    rating: z.number().min(1).max(5),
    comment: z.string().min(3, "Review comment too short").max(1000).transform(sanitize),
    images: z.array(z.string()).optional().default([]),
  }).strict(),
  params: z.object({}).strip(),
  query: z.object({}).strip(),
});
