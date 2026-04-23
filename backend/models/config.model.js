const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

/**
 * ENTERPRISE CONFIG SCHEMA (SINGLETON SAFE)
 */

let cachedConfig = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

const configSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      default: "CONFIG",
      unique: true, 
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
 * CONSOLIDATED INDEXES
 */
// configSchema.index({ singleton: 1 }, { unique: true }); // Duplicated by unique: true on field

/**
 * PRE-SAVE NORMALIZATION
 */
configSchema.pre("save", function (next) {
  try {
    if (this.phone) this.phone = this.phone.replace(/[^0-9+]/g, "");
    if (this.gst) this.gst = this.gst.toUpperCase();
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC METHODS
 */
configSchema.statics.getSingleton = async function () {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL) return cachedConfig;

  try {
    const doc = await this.findOneAndUpdate(
      { singleton: "CONFIG" },
      { $setOnInsert: { singleton: "CONFIG" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    cachedConfig = doc;
    lastFetchTime = now;
    return doc;
  } catch (err) {
    logger.error("CONFIG_FETCH_FAILED", { error: err.message });
    if (cachedConfig) return cachedConfig;
    throw err;
  }
};

configSchema.statics.updateConfig = async function (updates) {
  try {
    const doc = await this.findOneAndUpdate({ singleton: "CONFIG" }, updates, { new: true });
    cachedConfig = doc;
    lastFetchTime = Date.now();
    return doc;
  } catch (err) {
    logger.error("CONFIG_UPDATE_FAILED", { error: err.message });
    throw err;
  }
};

module.exports =
  mongoose.models.Config ||
  mongoose.model("Config", configSchema);