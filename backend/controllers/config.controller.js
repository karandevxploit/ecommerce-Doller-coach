const Config = require("../models/config.model");
const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const cloudinary = require("../config/cloudinary");

/**
 * Public: Get configuration
 */
exports.getConfig = asyncHandler(async (req, res) => {
  const config = await Config.findOne().lean();
  return ok(res, config || {}, "");
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

    return ok(res, { logo: config.logo }, "Logo updated successfully");
  } catch (err) {
    console.error("Logo Upload Error:", err);
    return fail(res, err.message || "Failed to upload logo", 500);
  }
});
