const Config = require("../models/config.model");
const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis"); // ✅ use safe wrapper
const { logger } = require("../utils/logger");

const CACHE_KEY = "app:config";
const CACHE_TTL = 3600; // 1 hour

// ===============================
// DEFAULT FALLBACK CONFIG
// ===============================
const DEFAULT_CONFIG = Object.freeze({
  company_name: "Doller Coach",
  email: "",
  phone: "",
  gst: "",
  address: "",
});

// ===============================
// GET CONFIG (CACHE SAFE)
// ===============================
exports.getConfig = asyncHandler(async (req, res) => {
  try {
    // 1. Try Redis (safe)
    const cached = await safeCall((r) => r.get(CACHE_KEY));
    if (cached) {
      return ok(res, JSON.parse(cached), "Config (cache)");
    }

    // 2. DB fallback
    const config = await Config.findOne().lean();
    const result = config || DEFAULT_CONFIG;

    // 3. Cache (non-blocking)
    safeCall((r) =>
      r.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL)
    );

    return ok(res, result, "Config (db)");
  } catch (err) {
    logger.error("[CONFIG_GET_ERROR]", { message: err.message });

    // graceful fallback (NEVER break UI)
    return ok(res, DEFAULT_CONFIG, "Fallback config");
  }
});

// ===============================
// UPDATE CONFIG (SAFE + VALIDATED)
// ===============================
exports.updateConfig = asyncHandler(async (req, res) => {
  const { company_name, phone, email, gst, address } = req.body || {};

  // 1. Basic validation (fast fail)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, "Invalid email format", 400);
  }

  if (phone && !/^[0-9]{10}$/.test(phone)) {
    return fail(res, "Invalid phone number", 400);
  }

  // 2. Atomic upsert
  const updated = await Config.findOneAndUpdate(
    {},
    {
      $set: {
        ...(company_name && { company_name }),
        ...(phone && { phone }),
        ...(email && { email }),
        ...(gst && { gst }),
        ...(address && { address }),
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  // 3. Cache invalidation (safe)
  safeCall((r) => r.del(CACHE_KEY));

  return ok(res, updated, "Configuration updated");
});