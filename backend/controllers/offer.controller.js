const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const { ok, fail } = require("../utils/apiResponse");
const Offer = require("../models/offer.model");
const { broadcastOffer } = require("../services/notification.service");
const emailService = require("../services/email.service");
const cache = require("../services/cache.service");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_KEY = "offers:active:v2";
const CACHE_TTL = 300;
const ALLOWED_DISCOUNT_TYPES = new Set(["percentage", "flat"]);
const ALLOWED_SCOPES = new Set(["all", "category", "product"]);

const clean = (value = "") => String(value ?? "").trim();
const normalizeCode = (value = "") => clean(value).toUpperCase();
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "active", "on"].includes(clean(value).toLowerCase());
};
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toNullablePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const toNullableMoney = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parseDate = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  return date;
};

const calculateStatus = (offer = {}) => {
  if (offer.isDeleted) return "DELETED";
  if (!offer.isActive) return "OFF";

  const current = Date.now();
  const start = offer.startDate ? new Date(offer.startDate).getTime() : 0;
  const end = offer.endDate ? new Date(offer.endDate).getTime() : 0;
  const usageLimit = toNumber(offer.usageLimit, 0);

  if (usageLimit > 0 && toNumber(offer.usedCount, 0) >= usageLimit) return "LIMIT ENDED";
  if (end && current > end) return "EXPIRED";
  if (start && current < start) return "COMING";
  return "ACTIVE";
};

const normalizeOffer = (offer = {}) => {
  const status = calculateStatus(offer);
  const targetDate = status === "COMING" ? offer.startDate : offer.endDate;
  const targetTime = targetDate ? new Date(targetDate).getTime() : 0;
  const remainingTime = targetTime ? Math.max(0, targetTime - Date.now()) : 0;
  const discountValue = toNumber(offer.discountValue, 0);

  return {
    ...offer,
    id: String(offer._id || offer.id || ""),
    _id: offer._id,
    imageUrl: offer.image || "",
    expiryDate: offer.endDate || null,
    status,
    remainingTime,
    couponCode: normalizeCode(offer.couponCode),
    discount: discountValue,
    discountValue,
    minOrderValue: toNumber(offer.minOrderAmount, 0),
    usageLimit: offer.usageLimit ?? null,
    perUserLimit: offer.perUserLimit ?? null,
  };
};

const normalizePayload = (body = {}, { partial = false } = {}) => {
  const payload = {};

  if (!partial || body.title !== undefined) {
    payload.title = clean(body.title);
    if (!payload.title) throw new Error("Offer title required");
    if (payload.title.length > 150) throw new Error("Offer title is too long");
  }

  if (!partial || body.description !== undefined) {
    payload.description = clean(body.description || payload.title || body.title);
    if (!payload.description) payload.description = payload.title || "Special offer";
    if (payload.description.length > 500) throw new Error("Description is too long");
  }

  if (!partial || body.discountType !== undefined) {
    payload.discountType = clean(body.discountType || "percentage").toLowerCase();
    if (!ALLOWED_DISCOUNT_TYPES.has(payload.discountType)) throw new Error("Invalid discount type");
  }

  if (!partial || body.discountValue !== undefined || body.discount !== undefined) {
    payload.discountValue = toNumber(body.discountValue ?? body.discount, NaN);
    if (!Number.isFinite(payload.discountValue) || payload.discountValue <= 0) throw new Error("Invalid discount");
  }

  if (payload.discountType === "percentage" && payload.discountValue > 100) {
    throw new Error("Percentage discount cannot exceed 100");
  }

  if (!partial || body.startDate !== undefined) {
    payload.startDate = parseDate(body.startDate);
    if (!payload.startDate) throw new Error("Valid start date required");
  }

  if (!partial || body.endDate !== undefined) {
    payload.endDate = parseDate(body.endDate, { endOfDay: true });
    if (!payload.endDate) throw new Error("Valid end date required");
  }

  const startDate = payload.startDate || (body.startDate ? parseDate(body.startDate) : null);
  const endDate = payload.endDate || (body.endDate ? parseDate(body.endDate, { endOfDay: true }) : null);
  if (startDate && endDate && endDate <= startDate) throw new Error("End date must be after start date");

  if (body.couponCode !== undefined || !partial) payload.couponCode = normalizeCode(body.couponCode);
  if (!partial && !payload.couponCode) throw new Error("Coupon code required");

  if (body.applyTo !== undefined || !partial) {
    payload.applyTo = clean(body.applyTo || "all").toLowerCase();
    if (!ALLOWED_SCOPES.has(payload.applyTo)) throw new Error("Invalid offer scope");
  }

  const scope = payload.applyTo || body.applyTo;
  if (body.applyToCategory !== undefined || (!partial && scope === "category")) {
    payload.applyToCategory = clean(body.applyToCategory);
    if (scope === "category" && !payload.applyToCategory) throw new Error("Category required for category offer");
  }

  if (body.applyToProductId !== undefined || (!partial && scope === "product")) {
    const productId = clean(body.applyToProductId);
    payload.applyToProductId = productId || null;
    if (scope === "product" && !isObjectId(productId)) throw new Error("Valid product ID required for product offer");
  }

  if (scope !== "category" && (body.applyTo !== undefined || !partial)) payload.applyToCategory = "";
  if (scope !== "product" && (body.applyTo !== undefined || !partial)) payload.applyToProductId = null;

  if (body.image !== undefined || !partial) payload.image = clean(body.image);
  if (body.link !== undefined || !partial) payload.link = clean(body.link || "/collection");
  if (body.minOrderAmount !== undefined || !partial) payload.minOrderAmount = Math.max(0, toNumber(body.minOrderAmount, 0));
  if (body.maxDiscount !== undefined || !partial) payload.maxDiscount = toNullableMoney(body.maxDiscount);
  if (body.usageLimit !== undefined || !partial) payload.usageLimit = toNullablePositiveInt(body.usageLimit);
  if (body.perUserLimit !== undefined || !partial) payload.perUserLimit = toNullablePositiveInt(body.perUserLimit);
  if (body.priority !== undefined || !partial) payload.priority = Math.max(1, Math.min(100, toNumber(body.priority, 1)));
  if (body.isActive !== undefined || !partial) payload.isActive = toBool(body.isActive, true);

  return payload;
};

const validateMergedOffer = (offer = {}) => {
  const start = parseDate(offer.startDate);
  const end = parseDate(offer.endDate, { endOfDay: true });

  if (!start || !end) return "Valid start and end dates are required";
  if (end <= start) return "End date must be after start date";
  if (offer.applyTo === "category" && !clean(offer.applyToCategory)) return "Category required for category offer";
  if (offer.applyTo === "product" && !isObjectId(offer.applyToProductId)) return "Valid product ID required for product offer";
  if (offer.discountType === "percentage" && toNumber(offer.discountValue, 0) > 100) {
    return "Percentage discount cannot exceed 100";
  }
  return null;
};

const invalidateCache = () => safeCall((r) => r.del(CACHE_KEY)).catch(() => {});

exports.getActiveOffers = asyncHandler(async (_req, res) => {
  try {
    const data = await cache.getOrSet(CACHE_KEY, async () => {
      const current = new Date();
      const offers = await Offer.find({
        isActive: true,
        isDeleted: { $ne: true },
        endDate: { $gte: current },
      })
        .sort({ priority: -1, endDate: 1 })
        .select("-usedBy")
        .lean();

      return offers
        .map(normalizeOffer)
        .filter((offer) => offer.status === "ACTIVE" || offer.status === "COMING");
    }, CACHE_TTL);

    return ok(res, data, "Offers fetched");
  } catch (err) {
    logger.error("[OFFERS_GET_ERROR]", { message: err.message });
    return ok(res, [], "Fallback");
  }
});

exports.listOffers = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") return fail(res, "Unauthorized", 403);

  const includeDeleted = ["1", "true", "yes"].includes(clean(req.query.includeDeleted).toLowerCase());
  const query = includeDeleted ? {} : { isDeleted: { $ne: true } };
  const offers = await Offer.find(query).sort({ priority: -1, createdAt: -1 }).lean();
  const items = offers.map(normalizeOffer);

  return ok(res, { offers: items, items });
});

exports.createOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") return fail(res, "Unauthorized", 403);

  let payload;
  try {
    payload = normalizePayload(req.body);
  } catch (err) {
    return fail(res, err.message, 400);
  }

  const duplicate = payload.couponCode
    ? await Offer.findOne({ couponCode: payload.couponCode, isDeleted: { $ne: true } }).select("_id").lean()
    : null;
  if (duplicate) return fail(res, "Coupon already exists", 409);

  const offer = await Offer.create({ ...payload, usedCount: 0 });
  invalidateCache();

  const response = normalizeOffer(offer.toObject());
  res.status(201).json({ success: true, data: response, message: "Offer created" });

  setImmediate(() => {
    broadcastOffer?.({ title: "New Offer Live", body: offer.title, type: "offer" })
      .catch((err) => logger.warn("Offer push failed", { message: err.message }));

    emailService.broadcastOfferEmail?.({ offer })
      .catch((err) => logger.warn("Offer email failed", { message: err.message }));
  });
});

exports.updateOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") return fail(res, "Unauthorized", 403);
  if (!isObjectId(req.params.id)) return fail(res, "Invalid offer ID", 400);

  let payload;
  try {
    payload = normalizePayload(req.body, { partial: true });
  } catch (err) {
    return fail(res, err.message, 400);
  }

  const existing = await Offer.findById(req.params.id).lean();
  if (!existing) return fail(res, "Offer not found", 404);

  const merged = { ...existing, ...payload };
  const mergedError = validateMergedOffer(merged);
  if (mergedError) return fail(res, mergedError, 400);

  if (payload.couponCode) {
    const exists = await Offer.findOne({
      couponCode: payload.couponCode,
      isDeleted: { $ne: true },
      _id: { $ne: req.params.id },
    }).select("_id").lean();
    if (exists) return fail(res, "Coupon already exists", 409);
  }

  const offer = await Offer.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean();

  invalidateCache();
  return ok(res, normalizeOffer(offer), "Offer updated");
});

exports.deleteOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") return fail(res, "Unauthorized", 403);
  if (!isObjectId(req.params.id)) return fail(res, "Invalid offer ID", 400);

  const deleted = await Offer.findByIdAndUpdate(
    req.params.id,
    { $set: { isDeleted: true, isActive: false } },
    { new: true }
  ).lean();

  if (!deleted) return fail(res, "Offer not found", 404);

  invalidateCache();
  return ok(res, { deleted: true, offer: normalizeOffer(deleted) }, "Offer deleted");
});
