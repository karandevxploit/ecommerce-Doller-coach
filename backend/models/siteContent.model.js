const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

/**
 * ENTERPRISE SITE CONTENT (CMS)
 *
 * Features:
 * - Singleton enforcement
 * - Caching layer
 * - Validation
 * - Safe flexibility (controlled strict mode)
 * - Offer filtering
 */

let cachedContent = null;
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 min

const siteContentSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      default: "SITE_CONTENT",
      unique: true,
      immutable: true,
    },

    branding: {
      logo: {
        url: { type: String, default: "" },
        public_id: { type: String, default: "" },
      },
    },

    heroCarousel: [
      {
        image: { type: String, default: "" },
        heading: { type: String, default: "", maxlength: 200 },
        subheading: { type: String, default: "", maxlength: 300 },

        offer: {
          text: { type: String, default: "" },
          enabled: { type: Boolean, default: true },
          startDate: { type: Date },
          endDate: { type: Date },
        },

        order: { type: Number, default: 0, index: true },
      },
    ],

    headings: {
      bestSellersTitle: { type: String, default: "Best Sellers" },
      trendingTitle: { type: String, default: "Trending Now" },
      newArrivalsTitle: { type: String, default: "New Arrivals" },
    },

    banners: {
      promoBanner: {
        image: { type: String, default: "" },
        text: { type: String, default: "" },
        subtext: { type: String, default: "" },
      },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /**
     * Soft delete / version safety
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true, // FIXED (no uncontrolled fields)
  }
);

/**
 * INDEXES
 */
siteContentSchema.index({ singleton: 1 }, { unique: true });
siteContentSchema.index({ "heroCarousel.order": 1 });

/**
 * STATIC: Get Singleton (Cached + Safe)
 */
siteContentSchema.statics.getContent = async function () {
  const now = Date.now();

  if (cachedContent && now - lastFetch < CACHE_TTL) {
    return cachedContent;
  }

  try {
    const doc = await this.findOneAndUpdate(
      { singleton: "SITE_CONTENT" },
      { $setOnInsert: { singleton: "SITE_CONTENT" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    // Filter expired offers
    const currentTime = new Date();

    if (doc.heroCarousel?.length) {
      doc.heroCarousel = doc.heroCarousel
        .filter((item) => {
          if (!item.offer?.enabled) return true;

          const { startDate, endDate } = item.offer;

          if (startDate && currentTime < startDate) return false;
          if (endDate && currentTime > endDate) return false;

          return true;
        })
        .sort((a, b) => a.order - b.order);
    }

    cachedContent = doc;
    lastFetch = now;

    return doc;
  } catch (err) {
    logger.error("SITE_CONTENT_FETCH_FAILED", {
      error: err.message,
    });

    if (cachedContent) return cachedContent;

    throw err;
  }
};

/**
 * STATIC: Update Content (Invalidate Cache)
 */
siteContentSchema.statics.updateContent = async function (updates, userId) {
  try {
    const doc = await this.findOneAndUpdate(
      { singleton: "SITE_CONTENT" },
      { ...updates, updatedBy: userId },
      { new: true }
    );

    cachedContent = null;
    lastFetch = 0;

    return doc;
  } catch (err) {
    logger.error("SITE_CONTENT_UPDATE_FAILED", {
      error: err.message,
    });
    throw err;
  }
};

module.exports =
  mongoose.models.SiteContent ||
  mongoose.model("SiteContent", siteContentSchema);