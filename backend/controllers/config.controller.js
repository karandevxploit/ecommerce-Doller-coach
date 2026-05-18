const Config = require("../models/config.model");
const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_KEY = "app:config";
const CACHE_TTL = 3600;

const DEFAULT_CONFIG = Object.freeze({
  company_name: "Doller Coach",
  email: "",
  phone: "",
  gst: "",
  address: "",
});

const PUBLIC_FIELDS = ["company_name", "email", "phone", "gst", "address"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_RE = /^[A-Z0-9-]{5,20}$/;

const clean = (value = "") => String(value ?? "").trim();
const cleanPhone = (value = "") => clean(value).replace(/[^\d+]/g, "");

const publicConfig = (source = {}) => {
  const raw = source && typeof source.toObject === "function" ? source.toObject() : source;

  return PUBLIC_FIELDS.reduce((result, field) => {
    result[field] = clean(raw?.[field] ?? DEFAULT_CONFIG[field] ?? "");
    return result;
  }, {});
};

const parseCachedConfig = (cached) => {
  if (!cached) return null;

  try {
    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
    return publicConfig(parsed);
  } catch (err) {
    logger.warn("[CONFIG_CACHE_PARSE_ERROR]", { message: err.message });
    safeCall((r) => r.del(CACHE_KEY)).catch(() => {});
    return null;
  }
};

const normalizeUpdates = (body = {}) => {
  const updates = {};

  if (body.company_name !== undefined) {
    updates.company_name = clean(body.company_name);
    if (!updates.company_name) throw new Error("Company name is required");
    if (updates.company_name.length > 100) throw new Error("Company name is too long");
  }

  if (body.email !== undefined) {
    updates.email = clean(body.email).toLowerCase();
    if (updates.email && !EMAIL_RE.test(updates.email)) throw new Error("Invalid email format");
  }

  if (body.phone !== undefined) {
    updates.phone = cleanPhone(body.phone);
    const digits = updates.phone.replace(/\D/g, "");
    if (updates.phone && (digits.length < 8 || digits.length > 15)) {
      throw new Error("Invalid phone number");
    }
  }

  if (body.gst !== undefined) {
    updates.gst = clean(body.gst).toUpperCase();
    if (updates.gst && !GST_RE.test(updates.gst)) throw new Error("Invalid GST number");
  }

  if (body.address !== undefined) {
    updates.address = clean(body.address);
    if (updates.address.length > 300) throw new Error("Address is too long");
  }

  if (!Object.keys(updates).length) throw new Error("No valid configuration fields provided");
  return updates;
};

exports.getConfig = asyncHandler(async (req, res) => {
  try {
    const cached = await safeCall((r) => r.get(CACHE_KEY));
    const cachedConfig = parseCachedConfig(cached);
    if (cachedConfig) return ok(res, cachedConfig, "Config");

    const config = typeof Config.getSingleton === "function"
      ? await Config.getSingleton()
      : await Config.findOne().lean();
    const result = publicConfig(config || DEFAULT_CONFIG);

    safeCall((r) => r.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL)).catch(() => {});

    return ok(res, result, "Config");
  } catch (err) {
    logger.error("[CONFIG_GET_ERROR]", { message: err.message });
    return ok(res, publicConfig(DEFAULT_CONFIG), "Fallback config");
  }
});

exports.updateConfig = asyncHandler(async (req, res) => {
  let updates;
  try {
    updates = normalizeUpdates(req.body || {});
  } catch (err) {
    return fail(res, err.message, 400);
  }

  const updated = await Config.findOneAndUpdate(
    { singleton: "CONFIG" },
    { $set: updates, $setOnInsert: { singleton: "CONFIG" } },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  const result = publicConfig(updated);
  safeCall((r) => r.set(CACHE_KEY, JSON.stringify(result), "EX", CACHE_TTL)).catch(() => {});

  return ok(res, result, "Configuration updated");
});
