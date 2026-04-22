const Coupon = require("../models/coupon.model");
const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");

const now = () => new Date();

// ===============================
// HELPER: UNIFIED COUPON FETCH
// ===============================
const getCoupon = async (code) => {
  const normalized = code.trim().toUpperCase();

  let coupon = await Coupon.findOne({ code: normalized }).lean();

  if (!coupon) {
    const Offer = require("../models/offer.model");
    const offer = await Offer.findOne({
      couponCode: normalized,
      isActive: true,
    }).lean();

    if (!offer) return null;

    coupon = {
      _id: offer._id,
      code: offer.couponCode,
      discountType: offer.discountType === "flat" ? "fixed" : "percentage",
      discountValue: offer.discountValue,
      minOrderAmount: offer.minOrderAmount || 0,
      maxDiscount: offer.maxDiscount,
      expiryDate: offer.endDate || offer.expiryDate,
      startDate: offer.startDate,
      usageLimit: offer.usageLimit,
      usedCount: offer.usedCount,
      isActive: offer.isActive,
    };
  }

  return coupon;
};

// ===============================
// LIST COUPONS
// ===============================
exports.listCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find({
    isActive: true,
    expiryDate: { $gt: now() },
  })
    .select("code discountType discountValue minOrderAmount maxDiscount expiryDate startDate usedCount usageLimit")
    .lean();

  const result = coupons
    .map((c) => {
      const isUpcoming = new Date(c.startDate) > now();
      const isLimitReached = c.usageLimit > 0 && c.usedCount >= c.usageLimit;

      if (isLimitReached) return null;

      return {
        ...c,
        id: c._id,
        status: isUpcoming ? "upcoming" : "active",
      };
    })
    .filter(Boolean);

  return ok(res, result);
});

// ===============================
// APPLY COUPON (SAFE)
// ===============================
exports.applyCoupon = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body;

  if (!code || !cartTotal || cartTotal <= 0) {
    return fail(res, "Invalid input", 400);
  }

  const coupon = await getCoupon(code);
  if (!coupon) {
    return ok(res, { success: false, message: "Invalid coupon" });
  }

  const nowTime = now();

  // STATUS CHECKS
  if (!coupon.isActive) {
    return ok(res, { success: false, message: "Coupon inactive" });
  }

  if (coupon.startDate && nowTime < new Date(coupon.startDate)) {
    return ok(res, { success: false, message: "Coupon not started" });
  }

  if (coupon.expiryDate && nowTime > new Date(coupon.expiryDate)) {
    return ok(res, { success: false, message: "Coupon expired" });
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return ok(res, { success: false, message: "Usage limit reached" });
  }

  if (cartTotal < coupon.minOrderAmount) {
    return ok(res, {
      success: false,
      message: `Minimum order ₹${coupon.minOrderAmount}`,
    });
  }

  // DISCOUNT CALCULATION
  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = Math.round((cartTotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.min(discount, cartTotal);
  const finalAmount = cartTotal - discount;

  return ok(res, {
    success: true,
    discount,
    finalAmount,
    couponCode: coupon.code,
  });
});

// ===============================
// VALIDATE COUPON (STRICT)
// ===============================
exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, cartItems } = req.body;

  if (!code || !Array.isArray(cartItems) || !cartItems.length) {
    return fail(res, "Invalid request", 400);
  }

  const coupon = await getCoupon(code);
  if (!coupon) {
    return ok(res, { success: false, message: "Invalid coupon" });
  }

  const nowTime = now();

  if (!coupon.isActive) {
    return ok(res, { success: false, message: "Inactive coupon" });
  }

  if (coupon.startDate && nowTime < new Date(coupon.startDate)) {
    return ok(res, { success: false, message: "Not started" });
  }

  if (coupon.expiryDate && nowTime > new Date(coupon.expiryDate)) {
    return ok(res, { success: false, message: "Expired" });
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return ok(res, { success: false, message: "Usage limit reached" });
  }

  // CALCULATE SUBTOTAL
  const subtotal = cartItems.reduce((sum, i) => {
    return sum + (Number(i.price) || 0) * (Number(i.quantity) || 1);
  }, 0);

  if (subtotal < coupon.minOrderAmount) {
    return ok(res, {
      success: false,
      message: `Minimum ₹${coupon.minOrderAmount}`,
    });
  }

  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.min(discount, subtotal);

  return ok(res, {
    success: true,
    subtotal,
    discount,
    finalTotal: subtotal - discount,
    couponCode: coupon.code,
  });
});