const asyncHandler = require("express-async-handler");
const Joi = require("joi");

const SiteContent = require("../models/siteContent.model");
const { ok, fail } = require("../utils/apiResponse");
const cache = require("../services/cache.service");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_KEY = "site:content";
const CACHE_TTL = 300;

const DEFAULT_CONTENT = {
  branding: {
    logo: {
      url: "",
      public_id: "",
    },
  },
  heroCarousel: [],
  headings: {
    bestSellersTitle: "Best Sellers",
    trendingTitle: "Trending",
    newArrivalsTitle: "New Arrivals",
  },
  banners: {
    promoBanner: {
      image: "",
      text: "New Collection",
      subtext: "Explore latest styles",
    },
  },
};

const carouselItemSchema = Joi.object({
  image: Joi.string().allow("").max(1000).default(""),
  imageUrl: Joi.string().allow("").max(1000).optional(),
  heading: Joi.string().allow("").max(200).default(""),
  title: Joi.string().allow("").max(200).optional(),
  subheading: Joi.string().allow("").max(300).default(""),
  subtitle: Joi.string().allow("").max(300).optional(),
  order: Joi.number().integer().min(0).max(100).optional(),
  offer: Joi.object({
    text: Joi.string().allow("").max(200).default(""),
    enabled: Joi.boolean().truthy("true").falsy("false").default(false),
    startDate: Joi.date().allow(null, "").default(null),
    endDate: Joi.date().allow(null, "").default(null),
  }).default(),
}).unknown(true);

const siteContentUpdateSchema = Joi.object({
  branding: Joi.object({
    logo: Joi.object({
      url: Joi.string().allow("").max(1000).default(""),
      public_id: Joi.string().allow("").max(300).default(""),
      publicId: Joi.string().allow("").max(300).optional(),
    }).default(),
  }).optional(),
  heroCarousel: Joi.array().items(carouselItemSchema).max(5).optional(),
  headings: Joi.object({
    bestSellersTitle: Joi.string().allow("").max(120).default("Best Sellers"),
    trendingTitle: Joi.string().allow("").max(120).default("Trending"),
    newArrivalsTitle: Joi.string().allow("").max(120).default("New Arrivals"),
  }).optional(),
  banners: Joi.object({
    promoBanner: Joi.object({
      image: Joi.string().allow("").max(1000).default(""),
      text: Joi.string().allow("").max(200).default(""),
      subtext: Joi.string().allow("").max(300).default(""),
    }).default(),
  }).optional(),
}).unknown(false);

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const mergeDeep = (base = {}, patch = {}) => {
  const output = { ...base };

  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      output[key] = value;
      return;
    }
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = mergeDeep(output[key], value);
      return;
    }
    output[key] = value;
  });

  return output;
};

const toSafeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeCarousel = (slides = []) => {
  if (!Array.isArray(slides)) return [];

  return slides
    .filter((slide) => slide && typeof slide === "object")
    .slice(0, 5)
    .map((slide, index) => ({
      image: String(slide.image || slide.imageUrl || "").trim(),
      heading: String(slide.heading || slide.title || "").trim(),
      subheading: String(slide.subheading || slide.subtitle || "").trim(),
      order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index,
      offer: {
        text: String(slide.offer?.text || "").trim(),
        enabled: Boolean(slide.offer?.enabled),
        startDate: toSafeDate(slide.offer?.startDate),
        endDate: toSafeDate(slide.offer?.endDate),
      },
    }))
    .sort((a, b) => a.order - b.order)
    .map((slide, index) => ({ ...slide, order: index }));
};

const normalizeContent = (content = {}) => {
  const merged = mergeDeep(DEFAULT_CONTENT, content || {});
  const now = new Date();

  const heroCarousel = normalizeCarousel(merged.heroCarousel).map((slide) => {
    const offer = slide.offer || {};
    const enabled =
      Boolean(offer.enabled) &&
      (!offer.startDate || new Date(offer.startDate) <= now) &&
      (!offer.endDate || new Date(offer.endDate) >= now);

    return {
      ...slide,
      offer: {
        ...offer,
        enabled,
      },
    };
  });

  return {
    branding: {
      logo: {
        url: String(merged.branding?.logo?.url || "").trim(),
        public_id: String(merged.branding?.logo?.public_id || merged.branding?.logo?.publicId || "").trim(),
      },
    },
    heroCarousel,
    headings: {
      bestSellersTitle: String(merged.headings?.bestSellersTitle || DEFAULT_CONTENT.headings.bestSellersTitle),
      trendingTitle: String(merged.headings?.trendingTitle || DEFAULT_CONTENT.headings.trendingTitle),
      newArrivalsTitle: String(merged.headings?.newArrivalsTitle || DEFAULT_CONTENT.headings.newArrivalsTitle),
    },
    banners: {
      promoBanner: {
        image: String(merged.banners?.promoBanner?.image || ""),
        text: String(merged.banners?.promoBanner?.text || DEFAULT_CONTENT.banners.promoBanner.text),
        subtext: String(merged.banners?.promoBanner?.subtext || DEFAULT_CONTENT.banners.promoBanner.subtext),
      },
    },
  };
};

const normalizeUpdatePayload = (payload = {}) => {
  const update = {};

  if (payload.branding) {
    update.branding = {
      logo: {
        url: String(payload.branding?.logo?.url || "").trim(),
        public_id: String(payload.branding?.logo?.public_id || payload.branding?.logo?.publicId || "").trim(),
      },
    };
  }

  if (payload.heroCarousel !== undefined) {
    update.heroCarousel = normalizeCarousel(payload.heroCarousel);
  }

  if (payload.headings) {
    update.headings = {
      bestSellersTitle: String(payload.headings.bestSellersTitle || DEFAULT_CONTENT.headings.bestSellersTitle),
      trendingTitle: String(payload.headings.trendingTitle || DEFAULT_CONTENT.headings.trendingTitle),
      newArrivalsTitle: String(payload.headings.newArrivalsTitle || DEFAULT_CONTENT.headings.newArrivalsTitle),
    };
  }

  if (payload.banners) {
    update.banners = {
      promoBanner: {
        image: String(payload.banners?.promoBanner?.image || ""),
        text: String(payload.banners?.promoBanner?.text || ""),
        subtext: String(payload.banners?.promoBanner?.subtext || ""),
      },
    };
  }

  return update;
};

exports.validateSiteContentUpdate = (req, res, next) => {
  const { error, value } = siteContentUpdateSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((detail) => detail.message).join(", ");
    return fail(res, `Validation failed: ${message}`, 400);
  }

  req.body = value;
  return next();
};

// ===============================
// GET SITE CONTENT
// ===============================
exports.getSiteContent = asyncHandler(async (req, res) => {
  try {
    const content = await cache.getOrSet(
      CACHE_KEY,
      async () => {
        const doc = await SiteContent.findOne({ singleton: "SITE_CONTENT", isDeleted: { $ne: true } })
          .lean();

        return normalizeContent(doc || DEFAULT_CONTENT);
      },
      CACHE_TTL
    );

    return ok(res, content || DEFAULT_CONTENT, "Site content fetched");
  } catch (err) {
    logger.error("[SITE_CONTENT_GET_ERROR]", { message: err.message });
    return ok(res, DEFAULT_CONTENT, "Fallback content");
  }
});

// ===============================
// UPDATE SITE CONTENT
// ===============================
exports.updateSiteContent = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  try {
    const updateData = normalizeUpdatePayload(req.body || {});

    const updated = await SiteContent.findOneAndUpdate(
      { singleton: "SITE_CONTENT" },
      {
        $set: {
          ...updateData,
          isDeleted: false,
          updatedBy: req.user._id,
        },
        $setOnInsert: {
          singleton: "SITE_CONTENT",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    await Promise.allSettled([
      cache.del(CACHE_KEY),
      safeCall((r) => r.del(CACHE_KEY)),
    ]);

    return ok(res, normalizeContent(updated), "Site content updated successfully");
  } catch (err) {
    logger.error("[SITE_CONTENT_UPDATE_ERROR]", {
      message: err.message,
      user: req.user?._id,
    });

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((item) => item.message);
      return fail(res, `Validation failed: ${messages.join(", ")}`, 400);
    }

    if (err.name === "CastError") {
      return fail(res, "Invalid site content data", 400);
    }

    return fail(res, "Failed to update site content", 500);
  }
});
