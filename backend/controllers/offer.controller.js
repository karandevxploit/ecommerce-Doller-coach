const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const { ok, fail } = require("../utils/apiResponse");
const Offer = require("../models/offer.model");

const { broadcastOffer } = require("../services/notification.service");
const { broadcastOfferEmail } = require("../services/email.service");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_KEY = "offers:active";
const CACHE_TTL = 300; // 5 min

// ===============================
// STATUS CALCULATOR
// ===============================
const calculateStatus = (offer) => {
  const now = new Date();
  const start = new Date(offer.startDate);
  const end = new Date(offer.endDate);

  if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit) {
    return "LIMIT ENDED";
  }
  if (now > end) return "EXPIRED";
  if (now < start) return "COMING";
  return "ACTIVE";
};

// ===============================
// VALIDATION
// ===============================
const validateOffer = (payload) => {
  if (!payload.title || !String(payload.title).trim()) {
    return "Offer title required";
  }

  const start = new Date(payload.startDate);
  const end = new Date(payload.endDate);

  if (!payload.startDate || !payload.endDate) {
    return "Start & end date required";
  }

  if (isNaN(start) || isNaN(end)) {
    return "Invalid dates";
  }

  if (end <= start) {
    return "End date must be greater than start";
  }

  const discount = Number(payload.discountValue || 0);
  if (!Number.isFinite(discount) || discount < 0) {
    return "Invalid discount";
  }

  if (payload.discountType === "percentage" && discount > 100) {
    return "Discount > 100% not allowed";
  }

  return null;
};

// ===============================
// GET ACTIVE OFFERS (CACHED)
// ===============================
exports.getActiveOffers = asyncHandler(async (_req, res) => {
  const cached = await safeCall((r) => r.get(CACHE_KEY));
  if (cached) {
    return ok(res, JSON.parse(cached), "Offers (cache)");
  }

  const now = new Date();

  const offers = await Offer.find({
    isActive: true,
    endDate: { $gte: now },
  })
    .sort({ priority: -1 })
    .select("title image description discountType discountValue startDate endDate usageLimit usedCount couponCode priority")
    .lean();

  const formatted = offers.map((o) => ({
    ...o,
    status: calculateStatus(o),
  }));

  // async cache
  safeCall((r) =>
    r.set(CACHE_KEY, JSON.stringify(formatted), "EX", CACHE_TTL)
  );

  return ok(res, formatted, "Offers (db)");
});

// ===============================
// LIST ALL OFFERS (ADMIN)
// ===============================
exports.listOffers = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const offers = await Offer.find({})
    .sort({ createdAt: -1 })
    .lean();

  const formatted = offers.map((o) => ({
    ...o,
    status: calculateStatus(o),
  }));

  return ok(res, formatted);
});

// ===============================
// CREATE OFFER (SAFE)
// ===============================
exports.createOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const payload = { ...req.body };

  // 📝 PRE-VALIDATION
  if (!payload.title || !payload.image) {
    return fail(res, "Title and Image are mandatory", 400);
  }

  const error = validateOffer(payload);
  if (error) return fail(res, error, 400);

  payload.couponCode = String(payload.couponCode || "").toUpperCase().trim();

  // ❗ Duplicate coupon protection
  if (payload.couponCode) {
    const exists = await Offer.findOne({ couponCode: payload.couponCode });
    if (exists) {
      return fail(res, "Coupon code already exists", 409);
    }
  }

  payload.discountValue = Number(payload.discountValue || 0);
  payload.startDate = new Date(payload.startDate);
  payload.endDate = new Date(payload.endDate);
  payload.minOrderAmount = Number(payload.minOrderAmount || 0);
  payload.maxDiscount =
    payload.maxDiscount !== "" && payload.maxDiscount !== null
      ? Number(payload.maxDiscount)
      : null;

  payload.usageLimit = Number(payload.usageLimit || 0);
  payload.usedCount = 0;

  payload.isActive = payload.isActive === true || payload.isActive === "true";

  const offer = await Offer.create(payload);

  // invalidate cache
  safeCall((r) => r.del(CACHE_KEY));

  // async broadcast (non-blocking)
  if (typeof broadcastOffer === "function") {
    broadcastOffer({
      title: "🔥 New Offer Live",
      body: offer.title,
    }).catch((e) => logger.warn("Push fail", e));
  }

  if (typeof broadcastOfferEmail === "function") {
    broadcastOfferEmail({ offer }).catch((e) => logger.warn("Email fail", e));
  }

  return ok(res, offer, "Offer created", 201);
});

// ===============================
// UPDATE OFFER (SAFE)
// ===============================
exports.updateOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const payload = { ...req.body };

  if (payload.discountValue !== undefined) {
    payload.discountValue = Number(payload.discountValue || 0);
    if (!Number.isFinite(payload.discountValue) || payload.discountValue < 0) {
      return fail(res, "Invalid discount", 400);
    }
  }

  if (payload.couponCode !== undefined) {
    payload.couponCode = String(payload.couponCode).toUpperCase().trim();

    const exists = await Offer.findOne({
      couponCode: payload.couponCode,
      _id: { $ne: req.params.id },
    });

    if (exists) {
      return fail(res, "Coupon already exists", 409);
    }
  }

  const offer = await Offer.findByIdAndUpdate(
    req.params.id,
    payload,
    { new: true }
  );

  if (!offer) return fail(res, "Offer not found", 404);

  safeCall((r) => r.del(CACHE_KEY));

  return ok(res, offer, "Offer updated");
});

// ===============================
// DELETE OFFER
// ===============================
exports.deleteOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const deleted = await Offer.findByIdAndDelete(req.params.id);

  if (!deleted) return fail(res, "Offer not found", 404);

  safeCall((r) => r.del(CACHE_KEY));

  return ok(res, { deleted: true });
});