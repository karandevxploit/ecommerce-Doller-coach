const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const Offer = require("../models/offer.model");
const { broadcastOffer } = require("../services/notification.service");
const { broadcastOfferEmail } = require("../services/email.service");

const calculateStatus = (offer) => {
  const now = new Date();
  const start = new Date(offer.startDate);
  const end = new Date(offer.endDate);

  if (offer.usageLimit > 0 && offer.usedCount >= offer.usageLimit) {
    return "LIMIT ENDED";
  }
  if (now > end) {
    return "EXPIRED";
  }
  if (now < start) {
    return "COMING";
  }
  if (now >= start && now <= end) {
    return "ACTIVE";
  }
  return "EXPIRED"; // Fallback
};

exports.getActiveOffers = asyncHandler(async (_req, res) => {
  const now = new Date();
  const offers = await Offer.find({
    isActive: true,
    endDate: { $gte: now }, // Include 'COMING' and 'ACTIVE'
  })
    .sort({ priority: -1 })
    .lean();

  const formatted = offers.map(o => ({
    ...o,
    status: calculateStatus(o)
  }));

  return ok(res, formatted, "");
});

exports.listOffers = asyncHandler(async (_req, res) => {
  const offers = await Offer.find({}).sort({ createdAt: -1 }).lean();
  const formatted = offers.map(o => ({
    ...o,
    status: calculateStatus(o)
  }));
  return ok(res, formatted, "");
});

exports.createOffer = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (!payload.title || !String(payload.title).trim()) {
    return fail(res, "Offer title is required", 400);
  }
  if (!payload.startDate || !payload.endDate) {
    return fail(res, "Start and end date are required", 400);
  }
  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return fail(res, "Invalid offer date", 400);
  }
  if (endDate <= startDate) {
    return fail(res, "End date must be greater than start date", 400);
  }

  payload.discountType = payload.discountType || "percentage";
  payload.discountValue = Number(payload.discountValue || 0);
  if (!Number.isFinite(payload.discountValue) || payload.discountValue < 0) {
    return fail(res, "Invalid discount value", 400);
  }
  if (payload.discountType === "percentage" && payload.discountValue > 100) {
    return fail(res, "Percentage discount cannot exceed 100", 400);
  }
  payload.couponCode = String(payload.couponCode || "").toUpperCase().trim();
  payload.description = String(payload.description || payload.title || "").trim();
  payload.startDate = startDate;
  payload.endDate = endDate;
  payload.minOrderAmount = Number(payload.minOrderAmount || 0);
  payload.maxDiscount = (payload.maxDiscount !== "" && payload.maxDiscount !== null) ? Number(payload.maxDiscount) : null;
  payload.usageLimit = Number(payload.usageLimit || 0);
  payload.perUserLimit = Number(payload.perUserLimit || 0);
  payload.isActive = payload.isActive === true || payload.isActive === "true";

  const offer = await Offer.create(payload);
  await broadcastOffer({ title: "New offer live", body: offer.title });
  broadcastOfferEmail({ offer }).catch(() => {});
  return ok(res, offer, "Offer created", 201);
});

exports.updateOffer = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.couponCode !== undefined) payload.couponCode = String(payload.couponCode || "").toUpperCase().trim();
  if (payload.discountValue !== undefined) {
    payload.discountValue = Number(payload.discountValue || 0);
    if (!Number.isFinite(payload.discountValue) || payload.discountValue < 0) {
      return fail(res, "Invalid discount value", 400);
    }
  }
  if (payload.minOrderAmount !== undefined) payload.minOrderAmount = Number(payload.minOrderAmount || 0);
  if (payload.maxDiscount !== undefined) payload.maxDiscount = payload.maxDiscount !== "" && payload.maxDiscount !== null ? Number(payload.maxDiscount) : null;
  
  if (payload.startDate !== undefined && payload.endDate !== undefined) {
    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    if (endDate <= startDate) {
      return fail(res, "End date must be greater than start date", 400);
    }
  }

  const offer = await Offer.findByIdAndUpdate(req.params.id, payload, { new: true });
  return ok(res, offer, "");
});

exports.deleteOffer = asyncHandler(async (req, res) => {
  await Offer.findByIdAndDelete(req.params.id);
  return ok(res, { deleted: true }, "");
});

