const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

/**
 * ENTERPRISE CONFIG SCHEMA (SINGLETON SAFE)
 *
 * Features:
 * - Strong singleton guarantee (DB enforced)
 * - Atomic upsert (race-condition safe)
 * - In-memory caching (fast reads)
 * - Validation & normalization
 * - Fail-safe fallback
 */

let cachedConfig = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

const configSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      default: "CONFIG",
      unique: true, // ensures only ONE document
      immutable: true,
    },

    company_name: {
      type: String,
      default: "Doller Coach",
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      default: "9690668290",
      trim: true,
    },

    email: {
      type: String,
      default: "dollercoach@gmail.com",
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    gst: {
      type: String,
      default: "09VKC236QJZE",
      uppercase: true,
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

/**
 * INDEX (fast lookup)
 */
configSchema.index({ singleton: 1 }, { unique: true });

/**
 * PRE-SAVE NORMALIZATION
 */
configSchema.pre("save", function (next) {
  try {
    if (this.phone) {
      this.phone = this.phone.replace(/[^0-9+]/g, "");
    }
    if (this.gst) {
      this.gst = this.gst.toUpperCase();
    }
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC: Get Singleton (Atomic + Cached)
 */
configSchema.statics.getSingleton = async function () {
  const now = Date.now();

  // Return cached version if valid
  if (cachedConfig && now - lastFetchTime < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    // Atomic upsert ensures no race condition
    const doc = await this.findOneAndUpdate(
      { singleton: "CONFIG" },
      { $setOnInsert: { singleton: "CONFIG" } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    cachedConfig = doc;
    lastFetchTime = now;

    return doc;
  } catch (err) {
    logger.error("CONFIG_FETCH_FAILED", {
      error: err.message,
    });

    // Fail-safe: return last known config
    if (cachedConfig) return cachedConfig;

    throw err;
  }
};

/**
 * STATIC: Update Config (Cache Invalidate)
 */
configSchema.statics.updateConfig = async function (updates) {
  try {
    const doc = await this.findOneAndUpdate(
      { singleton: "CONFIG" },
      updates,
      { new: true }
    );

    // Invalidate cache
    cachedConfig = doc;
    lastFetchTime = Date.now();

    return doc;
  } catch (err) {
    logger.error("CONFIG_UPDATE_FAILED", {
      error: err.message,
    });
    throw err;
  }
};

module.exports =
  mongoose.models.Config ||
  mongoose.model("Config", configSchema);