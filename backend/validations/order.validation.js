const { z } = require("zod");

/**
 * PRODUCTION-GRADE ORDER VALIDATION
 * Prevents fiscal mismatches and address corruption.
 */

const orderProductSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID"),
  quantity: z.number().int().min(1).max(20), // Max 20 per item safety cap
  size: z.string().optional(),
  color: z.string().optional(),
  price: z.number().min(1)
}).passthrough();

exports.createOrderSchema = z.object({
  body: z.object({
    products: z.array(orderProductSchema).min(1, "Order manifest must contain products"),
    address: z.object({
      name: z.string().optional(),
      fullName: z.string().optional(),
      phone: z.string().regex(/^[0-9]{10,12}$/, "Invalid phone pulse"),
      addressLine1: z.string().min(5, "Full address required"),
      addressLine2: z.string().optional(),
      landmark: z.string().optional(),
      city: z.string().min(2, "City required"),
      state: z.string().min(2, "State/Province required"),
      pincode: z.string().min(5, "Invalid postal code").max(10)
    }).passthrough(),
    paymentMethod: z.enum(["COD", "RAZORPAY", "ONLINE", "UPI"]),
    couponCode: z.string().nullable().optional(),
    subtotal: z.number().min(0),
    discount: z.number().min(0).optional().default(0),
    total: z.number().min(0).optional()
  })
});

exports.updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "returned"])
  })
});
