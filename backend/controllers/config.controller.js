const Config = require("../models/config.model");
const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const cloudinary = require("../config/cloudinary");
const redis = require("../config/redis");
const logger = require("../utils/logger");

const CACHE_KEY = "app:config";

/**
 * Public: Get configuration (Cached)
 */
exports.getConfig = asyncHandler(async (req, res) => {
  try {
    // 1. Check Redis Cache
    const cachedConfig = await redis.get(CACHE_KEY);
    if (cachedConfig) {
      return ok(res, JSON.parse(cachedConfig), "Config fetched from cache");
    }

    // 2. Fetch from DB
    const config = await Config.findOne().lean();
    const result = config || { 
      company_name: "Doller Coach", 
      email: "", 
      phone: "", 
      gst: "", 
      address: "", 
      logo: "" 
    };

    // 3. Populate Cache
    await redis.setex(CACHE_KEY, 3600, JSON.stringify(result)); // 1 hour TTL

    return ok(res, result, "Config fetched from DB");
  } catch (err) {
    logger.error("Error fetching config:", err);
    return fail(res, "Internal Server Error", 500);
  }
});

/**
 * Admin: Update configuration text fields
 */
exports.updateConfig = asyncHandler(async (req, res) => {
  const { company_name, phone, email, gst, address } = req.body;
  
  let config = await Config.findOne();
  if (!config) config = new Config();

  if (company_name) config.company_name = company_name;
  if (phone) config.phone = phone;
  if (email) config.email = email;
  if (gst) config.gst = gst;
  if (address) config.address = address;

  await config.save();
  await redis.del(CACHE_KEY); // Invalidate cache

  return ok(res, config, "Configuration updated");
});

/**
 * Admin: Upload logo to Cloudinary and update DB
 */
exports.uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, "No logo file provided", 400);

  try {
    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "assets",
      public_id: "brand_logo",
      overwrite: true,
      resource_type: "image",
    });

    // Update config in DB
    let config = await Config.findOne();
    if (!config) config = new Config();
    
    config.logo = result.secure_url;
    await config.save();
    
    await redis.del(CACHE_KEY); // Invalidate cache

    return ok(res, { logo: config.logo }, "Logo updated successfully");
  } catch (err) {
    logger.error("Logo Upload Error:", err);
    return fail(res, err.message || "Failed to upload logo", 500);
  }
});
