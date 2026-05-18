const { z } = require("zod");

/**
 * PRODUCTION-GRADE ORDER VALIDATION
 * Prevents fiscal mismatches and address corruption.
 */

const orderProductSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID"),
  quantity: z.number().int().min(1).max(20), // Max 20 per item safety cap
  size: z.string().optional(),
  topSize: z.string().optional(),
  bottomSize: z.string().optional(),
  color: z.string().optional(),
  price: z.number().min(1)
}).passthrough();

exports.createOrderSchema = z.object({
  body: z.object({
    items: z.array(orderProductSchema).min(1, "Order must contain items"),
    address: z.object({
      name: z.string().min(2),
      phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
      street: z.string().min(5, "Street must be at least 5 characters"),
      city: z.string().min(2),
      state: z.string().min(2),
      pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits")
    }).passthrough(),
    paymentMethod: z.enum(["COD", "RAZORPAY", "ONLINE"]),
    couponCode: z.string().optional(),
    charges: z.object({
      subtotal: z.number().nonnegative(),
      tax: z.number().nonnegative(),
      delivery: z.number().nonnegative(),
      discount: z.number().nonnegative().optional(),
      codFee: z.number().nonnegative(),
      total: z.number().positive()
    }).passthrough(),
    buyNow: z.boolean().optional()
  }).passthrough()
});

exports.updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "returned"])
  })
});
