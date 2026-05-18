const asyncHandler = require("express-async-handler");

const Coupon = require("../models/coupon.model");
const Offer = require("../models/offer.model");
const { ok, fail } = require("../utils/apiResponse");

const now = () => new Date();
const MAX_CART_TOTAL = 10_000_000;

const clean = (value = "") => String(value ?? "").trim();
const normalizeCode = (code = "") => clean(code).toUpperCase();
const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLimit = (value) => {
  const limit = safeNumber(value, 0);
  return limit > 0 ? limit : null;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeCouponDoc = (coupon) => {
  if (!coupon) return null;

  return {
    id: String(coupon._id || coupon.id || ""),
    _id: coupon._id,
    source: "coupon",
    code: normalizeCode(coupon.code),
    couponCode: normalizeCode(coupon.code),
    discountType: coupon.discountType === "fixed" ? "fixed" : "percentage",
    discountValue: safeNumber(coupon.discountValue, 0),
    minOrderAmount: safeNumber(coupon.minOrderAmount, 0),
    minOrderValue: safeNumber(coupon.minOrderAmount, 0),
    maxDiscount: coupon.maxDiscount == null ? null : safeNumber(coupon.maxDiscount, 0),
    startDate: normalizeDate(coupon.validFrom),
    expiryDate: normalizeDate(coupon.validTill),
    endDate: normalizeDate(coupon.validTill),
    usageLimit: normalizeLimit(coupon.usageLimit),
    usedCount: safeNumber(coupon.usedCount, 0),
    isActive: coupon.isActive !== false && coupon.isDeleted !== true,
  };
};

const normalizeOfferDoc = (offer) => {
  if (!offer) return null;

  return {
    id: String(offer._id || offer.id || ""),
    _id: offer._id,
    source: "offer",
    code: normalizeCode(offer.couponCode),
    couponCode: normalizeCode(offer.couponCode),
    discountType: offer.discountType === "flat" ? "fixed" : "percentage",
    discountValue: safeNumber(offer.discountValue, 0),
    minOrderAmount: safeNumber(offer.minOrderAmount, 0),
    minOrderValue: safeNumber(offer.minOrderAmount, 0),
    maxDiscount: offer.maxDiscount == null ? null : safeNumber(offer.maxDiscount, 0),
    startDate: normalizeDate(offer.startDate),
    expiryDate: normalizeDate(offer.endDate),
    endDate: normalizeDate(offer.endDate),
    usageLimit: normalizeLimit(offer.usageLimit),
    usedCount: safeNumber(offer.usedCount, 0),
    isActive: offer.isActive !== false && offer.isDeleted !== true,
  };
};

const getCoupon = async (code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  const coupon = await Coupon.findOne({ code: normalized, isDeleted: { $ne: true } }).lean();
  if (coupon) return normalizeCouponDoc(coupon);

  const offer = await Offer.findOne({
    couponCode: normalized,
    isDeleted: { $ne: true },
  }).lean();

  return normalizeOfferDoc(offer);
};

const getCouponStatus = (coupon) => {
  if (!coupon) return { valid: false, status: "invalid", message: "Invalid coupon" };
  if (!coupon.isActive) return { valid: false, status: "inactive", message: "Coupon inactive" };

  const current = now();
  if (coupon.startDate && current < coupon.startDate) {
    return { valid: false, status: "upcoming", message: "Coupon not started" };
  }
  if (coupon.expiryDate && current > coupon.expiryDate) {
    return { valid: false, status: "expired", message: "Coupon expired" };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, status: "limit_reached", message: "Usage limit reached" };
  }

  return { valid: true, status: "active", message: "Coupon active" };
};

const calculateDiscount = (coupon, amount) => {
  let discount = 0;

  if (coupon.discountType === "percentage") {
    discount = Math.round((amount * coupon.discountValue) / 100);
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.discountValue;
  }

  discount = Math.max(0, Math.min(Math.round(discount), amount));

  return {
    discount,
    discountAmount: discount,
    finalAmount: Math.max(amount - discount, 0),
    finalTotal: Math.max(amount - discount, 0),
  };
};

const inactiveResult = (coupon, status) => ({
  success: false,
  valid: false,
  code: coupon?.code || "",
  couponCode: coupon?.couponCode || coupon?.code || "",
  status: status.status,
  message: status.message,
});

const successResult = (coupon, amount) => ({
  success: true,
  valid: true,
  code: coupon.code,
  couponCode: coupon.couponCode || coupon.code,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  minOrderAmount: coupon.minOrderAmount,
  maxDiscount: coupon.maxDiscount,
  ...calculateDiscount(coupon, amount),
});

const getAmountFromBody = (body = {}) => safeNumber(
  body.cartTotal ?? body.subtotal ?? body.total ?? body.amount,
  0
);

exports.listCoupons = asyncHandler(async (req, res) => {
  const current = now();

  const [coupons, offers] = await Promise.all([
    Coupon.find({
      isActive: true,
      isDeleted: { $ne: true },
      validTill: { $gt: current },
    })
      .select("code discountType discountValue minOrderAmount maxDiscount validFrom validTill usedCount usageLimit isActive isDeleted")
      .sort({ validTill: 1, code: 1 })
      .lean(),
    Offer.find({
      isActive: true,
      isDeleted: { $ne: true },
      couponCode: { $ne: "" },
      endDate: { $gt: current },
    })
      .select("couponCode discountType discountValue minOrderAmount maxDiscount startDate endDate usedCount usageLimit isActive isDeleted priority")
      .sort({ priority: 1, endDate: 1 })
      .lean(),
  ]);

  const byCode = new Map();

  [...coupons.map(normalizeCouponDoc), ...offers.map(normalizeOfferDoc)]
    .filter((coupon) => coupon?.code)
    .forEach((coupon) => {
      const status = getCouponStatus(coupon);
      if (status.status === "expired" || status.status === "inactive" || status.status === "limit_reached") return;

      byCode.set(coupon.code, {
        ...coupon,
        status: status.status,
        message: status.message,
      });
    });

  return ok(res, Array.from(byCode.values()));
});

exports.applyCoupon = asyncHandler(async (req, res) => {
  const code = normalizeCode(req.body?.code);
  const cartTotal = getAmountFromBody(req.body);

  if (!code) return fail(res, "Coupon code is required", 400);
  if (cartTotal <= 0 || cartTotal > MAX_CART_TOTAL) return fail(res, "Invalid cart total", 400);

  const coupon = await getCoupon(code);
  const status = getCouponStatus(coupon);
  if (!status.valid) return ok(res, inactiveResult(coupon, status));

  if (cartTotal < coupon.minOrderAmount) {
    return ok(res, {
      ...inactiveResult(coupon, { status: "min_order", message: `Minimum order Rs ${coupon.minOrderAmount}` }),
      minOrderAmount: coupon.minOrderAmount,
      minOrderValue: coupon.minOrderAmount,
    });
  }

  return ok(res, successResult(coupon, cartTotal), "Coupon applied");
});

exports.validateCoupon = asyncHandler(async (req, res) => {
  const code = normalizeCode(req.body?.code);
  const cartItems = Array.isArray(req.body?.cartItems) ? req.body.cartItems : [];
  const amountFromBody = getAmountFromBody(req.body);

  if (!code) return fail(res, "Coupon code is required", 400);
  if (!cartItems.length && amountFromBody <= 0) return fail(res, "Cart total or cart items are required", 400);

  const subtotal = amountFromBody > 0
    ? amountFromBody
    : cartItems.reduce((sum, item) => {
        const price = safeNumber(item.price ?? item.salePrice ?? item.product?.price, 0);
        const quantity = Math.max(1, safeNumber(item.quantity, 1));
        return sum + price * quantity;
      }, 0);

  if (subtotal <= 0 || subtotal > MAX_CART_TOTAL) return fail(res, "Invalid cart total", 400);

  const coupon = await getCoupon(code);
  const status = getCouponStatus(coupon);
  if (!status.valid) return ok(res, inactiveResult(coupon, status));

  if (subtotal < coupon.minOrderAmount) {
    return ok(res, {
      ...inactiveResult(coupon, { status: "min_order", message: `Minimum order Rs ${coupon.minOrderAmount}` }),
      subtotal,
      minOrderAmount: coupon.minOrderAmount,
      minOrderValue: coupon.minOrderAmount,
    });
  }

  return ok(res, {
    ...successResult(coupon, subtotal),
    subtotal,
  }, "Coupon valid");
});
