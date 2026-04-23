const cloudinary = require("../config/cloudinary").getCloudinary();
const { ok, fail } = require("../utils/apiResponse");
const fs = require("fs");
const path = require("path");

// ===============================
// CONFIG
// ===============================
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

// ===============================
// SAFE LOGGER
// ===============================
const log = (type, msg, data) => {
  console.log(`[UPLOAD][${type}] ${msg}`, data || "");
};

// ===============================
// SAFE FILE DELETE (ASYNC)
// ===============================
const safeDelete = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err) log("WARN", "File delete failed", err.message);
  });
};

// ===============================
// VALIDATION
// ===============================
const validateFile = (file, allowedTypes) => {
  if (!file) return "No file uploaded";

  const isVideo = file.mimetype.startsWith("video/");
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    return `File too large (max ${maxSize / (1024 * 1024)}MB)`;
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return "Invalid file type";
  }

  return null;
};

// ===============================
// STREAM UPLOAD (BEST PRACTICE)
// ===============================
const streamUpload = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        ...options,
        quality: "auto",
        fetch_format: "auto",
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

exports.streamUpload = streamUpload;

// ===============================
// SINGLE IMAGE UPLOAD
// ===============================
exports.uploadSingle = async (req, res) => {
  try {
    const error = validateFile(req.file, ALLOWED_IMAGE_TYPES);
    if (error) return fail(res, error, 400);

    log("START", "Uploading image", {
      name: req.file.originalname,
      size: req.file.size,
    });

    const result = await streamUpload(req.file.buffer, {
      folder: "products/images",
    });

    log("SUCCESS", "Image uploaded", result.secure_url);

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });

  } catch (err) {
    log("ERROR", err.message);
    return fail(res, "Upload failed", 500);
  }
};

// ===============================
// MULTIPLE IMAGE UPLOAD
// ===============================
exports.uploadMultiple = async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const uploads = req.files.map(async (file) => {
      const error = validateFile(file, ALLOWED_IMAGE_TYPES);
      if (error) throw new Error(error);

      return streamUpload(file.buffer, {
        folder: "products/images",
      });
    });

    const results = await Promise.all(uploads);

    const urls = results.map((r) => r.secure_url);

    return res.json({ success: true, urls });

  } catch (err) {
    log("ERROR", err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ===============================
// VIDEO UPLOAD
// ===============================
exports.uploadVideo = async (req, res) => {
  try {
    const error = validateFile(req.file, ALLOWED_VIDEO_TYPES);
    if (error) return fail(res, error, 400);

    log("START", "Uploading video", {
      name: req.file.originalname,
      size: req.file.size,
    });

    const result = await streamUpload(req.file.buffer, {
      folder: "products/videos",
      resource_type: "video",
      eager: [
        { format: "mp4", video_codec: "h264" },
        { format: "webm", video_codec: "vp9" }
      ],
      eager_async: true
    });

    log("SUCCESS", "Video uploaded", result.secure_url);

    return ok(res, {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration || 0,
      size: result.bytes || req.file.size,
    });

  } catch (err) {
    log("ERROR", err.message);
    return fail(res, "Video upload failed", 500);
  }
};