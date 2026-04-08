const Coupon = require("../models/coupon.model");
const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const orderService = require("../services/order.service");

/**
 * List all available (active & unexpired) coupons
 * GET /api/coupons
 */
exports.listCoupons = asyncHandler(async (req, res) => {
  const now = new Date();
  
  // Fetch all valid coupons (those not yet expired)
  const coupons = await Coupon.find({
    isActive: true,
    expiryDate: { $gt: now }
  })
  .sort({ startDate: 1, discountValue: -1 })
  .select("code discountType discountValue minOrderAmount maxDiscount expiryDate startDate usedCount usageLimit");

  const formattedCoupons = coupons.map(c => {
    const isUpcoming = new Date(c.startDate) > now;
    const isActive = !isUpcoming;
    
    // Usage limit check for ACTIVE coupons
    const isLimitReached = c.usageLimit > 0 && c.usedCount >= c.usageLimit;
    
    return {
      ...c._doc,
      id: c._id,
      status: isUpcoming ? "upcoming" : (isLimitReached ? "limit_ended" : "active")
    };
  });

  // Filter out limit_ended from the list to keep it clean for users
  const availableCoupons = formattedCoupons.filter(c => c.status !== "limit_ended");

  return ok(res, availableCoupons, "Available and upcoming coupons fetched");
});

/**
 * Apply coupon and calculate discount (Production-Ready)
 * POST /api/coupons/apply
 */
exports.applyCoupon = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body;
  const now = new Date();

  if (!code || !cartTotal) {
    return ok(res, { success: false, message: "Invalid input manifest" });
  }

  const normalizedCode = code.trim().toUpperCase();
  
  // 1. Search in Coupon collection, then fallback to Offer collection
  let coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) {
      // Try searching Offer collection (Admin-created promotions)
      const Offer = require("../models/offer.model");
      const offerDoc = await Offer.findOne({ 
          couponCode: normalizedCode,
          isActive: true 
      });
      
      if (offerDoc) {
          // Normalize Offer to Coupon-like structure for the validation logic below
          coupon = {
              code: offerDoc.couponCode,
              discountType: offerDoc.discountType === "flat" ? "fixed" : "percentage",
              discountValue: offerDoc.discountValue,
              minOrderAmount: offerDoc.minOrderAmount || 0,
              maxDiscount: offerDoc.maxDiscount,
              expiryDate: offerDoc.endDate || offerDoc.expiryDate,
              usageLimit: offerDoc.usageLimit,
              usedCount: offerDoc.usedCount,
              isActive: offerDoc.isActive
          };
      }
  }

  // Check existence after both searches
  if (!coupon) {
    return ok(res, { success: false, message: "Invalid or expired coupon" });
  }

  // 2. Check isActive
  if (!coupon.isActive) {
    return ok(res, { success: false, message: "Coupon is currently deactivated" });
  }

  // 3. Check expiryDate
  if (new Date(coupon.expiryDate) < now) {
    return ok(res, { success: false, message: "Invalid or expired coupon" });
  }

  // 4. Check usageLimit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return ok(res, { success: false, message: "Coupon usage limit reached" });
  }

  // 5. Check cartTotal >= minOrderAmount
  if (cartTotal < coupon.minOrderAmount) {
    return ok(res, { success: false, message: `Min order for this coupon is ₹${coupon.minOrderAmount}` });
  }

  // 6. Discount Logic
  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = Math.round((cartTotal * coupon.discountValue) / 100);
    // Note: null maxDiscount is treated as infinity
    if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.discountValue;
  }

  // 7. Security: Prevent negative discount and cap at cart total
  discount = Math.min(discount, cartTotal);
  const finalAmount = Math.max(0, cartTotal - discount);

  return ok(res, {
    success: true,
    message: "Coupon applied successfully",
    discount,
    finalAmount,
    couponCode: coupon.code
  }, "Coupon authorization verified");
});

/**
 * Validate coupon against current cart
 * POST /api/coupons/apply
 * @body { code, products }
 */
exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, cartItems } = req.body;

  if (!code) return res.status(400).json({ success: false, message: "Coupon code required" });
  if (!cartItems || !cartItems.length) return res.status(400).json({ success: false, message: "Cart items required" });

  const normalizedCode = (code || "").trim().toUpperCase();
  
  // 1. Unified Search
  let coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) {
      const Offer = require("../models/offer.model");
      const offerDoc = await Offer.findOne({ 
          couponCode: normalizedCode,
          isActive: true 
      });
      if (offerDoc) {
          coupon = {
              code: offerDoc.couponCode,
              discountType: offerDoc.discountType === "flat" ? "fixed" : "percentage",
              discountValue: offerDoc.discountValue,
              minOrderAmount: offerDoc.minOrderAmount || 0,
              maxDiscount: offerDoc.maxDiscount,
              expiryDate: offerDoc.endDate || offerDoc.expiryDate,
              usageLimit: offerDoc.usageLimit,
              usedCount: offerDoc.usedCount,
              isActive: offerDoc.isActive
          };
      }
  }

  if (!coupon || !coupon.isActive) {
    return res.json({
      success: false,
      message: "Invalid or inactive coupon"
    });
  }

  const now = new Date();
  if (coupon.startDate && now < new Date(coupon.startDate)) {
    return res.json({ success: false, message: "Coupon not started" });
  }
  
  if (coupon.expiryDate && now > new Date(coupon.expiryDate)) {
    return res.json({ success: false, message: "Coupon expired" });
  }

  const subtotal = cartItems.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1);
  }, 0);

  if (subtotal < coupon.minOrderValue) {
    return res.json({ 
      success: false, 
      message: `Minimum order value of ${coupon.minOrderValue} not met` 
    });
  }

  const limit = coupon.usageLimit || coupon.limit;
  if (limit !== null && coupon.usedCount >= limit) {
    return res.json({ success: false, message: "Coupon limit reached" });
  }

  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== null) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  discountAmount = Math.min(discountAmount, subtotal);
  const finalTotal = subtotal - discountAmount;

  return res.json({
    success: true,
    message: "Coupon applied",
    data: {
      discountAmount,
      subtotal,
      finalTotal,
      couponCode: coupon.code
    }
  });
});
