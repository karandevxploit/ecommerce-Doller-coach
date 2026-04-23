const { z } = require("zod");

/**
 * PRODUCTION-GRADE ADDRESS VALIDATION
 */

exports.addressSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().regex(/^[0-9]{10,12}$/, "Invalid phone pulse"),
  addressLine1: z.string().min(5, "Address line 1 required"),
  addressLine2: z.string().optional().default(""),
  city: z.string().min(2, "City required"),
  state: z.string().min(2, "State required"),
  pincode: z.string().min(5, "Invalid pincode").max(10),
  country: z.string().default("India"),
  isDefault: z.boolean().optional().default(false),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable()
});
