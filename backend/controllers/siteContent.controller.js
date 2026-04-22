const SiteContent = require("../models/siteContent.model");
const asyncHandler = require("express-async-handler");

const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_KEY = "site:content";
const CACHE_TTL = 300; // 5 min

// ===============================
// DEFAULT STRUCTURE
// ===============================
const DEFAULT_CONTENT = Object.freeze({
  branding: { logo: { url: "" } },
  heroCarousel: [],
  headings: {
    bestSellersTitle: "Best Sellers",
    trendingTitle: "Trending Now",
    newArrivalsTitle: "New Arrivals",
  },
  banners: { promoBanner: { image: "", text: "" } },
});

// ===============================
// GET SITE CONTENT (CACHED)
// ===============================
exports.getSiteContent = asyncHandler(async (req, res) => {
  try {
    // 1. CACHE FIRST
    const cached = await safeCall((r) => r.get(CACHE_KEY));
    if (cached) {
      return ok(res, JSON.parse(cached), "Site content (cache)");
    }

    // 2. DB FETCH
    const content = await SiteContent.findOne()
      .sort({ createdAt: -1 })
      .lean();

    const base = content || DEFAULT_CONTENT;

    // 3. FILTER ACTIVE OFFERS
    const now = new Date();

    const processedCarousel = (base.heroCarousel || [])
      .map((slide) => {
        const offer = slide.offer || {};

        const isActive =
          offer.enabled &&
          (!offer.startDate || new Date(offer.startDate) <= now) &&
          (!offer.endDate || new Date(offer.endDate) >= now);

        return {
          ...slide,
          offer: isActive ? offer : { ...offer, enabled: false },
        };
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const result = { ...base, heroCarousel: processedCarousel };

    // 4. CACHE SET (NON-BLOCKING)
    safeCall((r) =>
      r.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL)
    );

    return ok(res, result, "Site content (db)");
  } catch (err) {
    logger.error("[SITE_CONTENT_GET_ERROR]", err);

    // FAIL SAFE (never break UI)
    return ok(res, DEFAULT_CONTENT, "Fallback content");
  }
});

// ===============================
// UPDATE SITE CONTENT (SECURE)
// ===============================
exports.updateSiteContent = asyncHandler(async (req, res) => {
  // 🔥 ADMIN CHECK
  if (!req.user || req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  try {
    const {
      branding,
      heroCarousel,
      headings,
      banners,
      ...rest
    } = req.body || {};

    // BASIC SANITIZATION
    const safeData = {
      ...(branding && { branding }),
      ...(heroCarousel && Array.isArray(heroCarousel) && { heroCarousel }),
      ...(headings && { headings }),
      ...(banners && { banners }),
      ...rest,
    };

    const updated = await SiteContent.findOneAndUpdate(
      {},
      {
        $set: {
          ...safeData,
          updatedBy: req.user._id,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true, // ✅ FIXED
      }
    );

    // CACHE INVALIDATE
    safeCall((r) => r.del(CACHE_KEY));

    logger.info("[SITE_CONTENT_UPDATED]", { user: req.user._id });

    return ok(res, updated, "Site content updated");
  } catch (error) {
    logger.error("[SITE_CONTENT_UPDATE_ERROR]", error);

    return fail(
      res,
      error.message || "Failed to update site content",
      500
    );
  }
});