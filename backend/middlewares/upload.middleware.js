const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { logger } = require("../utils/logger");
const { getRequestId } = require("./requestTracker");

/**
 * ENTERPRISE FILE UPLOAD SYSTEM
 */

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Ensure directory exists (async safe)
const ensureDir = async (dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    logger.error("Upload dir creation failed", { error: err.message });
  }
};

// File filter (security gate)
const fileFilter = (allowedTypes) => (req, file, cb) => {
  try {
    const requestId = getRequestId?.() || "unknown";

    if (!allowedTypes.has(file.mimetype)) {
      logger.warn("Blocked file upload (invalid MIME)", {
        requestId,
        mimetype: file.mimetype,
        filename: file.originalname,
      });
      return cb(new Error("Invalid file type"), false);
    }

    cb(null, true);
  } catch (err) {
    cb(err, false);
  }
};

// Storage configs
const memoryStorage = multer.memoryStorage();

// Disk storage for local file processing (e.g. Docx templates)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "assets", "tmp");
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `template-${Date.now()}${ext}`);
  }
});

// Common multer config factory
const createUploader = (allowedTypes, maxSize, storage = memoryStorage) =>
  multer({
    storage,
    fileFilter: fileFilter(allowedTypes),
    limits: {
      fileSize: maxSize,
      files: 10,
    },
  });

// Upload instances
const upload = createUploader(IMAGE_MIME_TYPES, 5 * 1024 * 1024); // 5MB images
const videoUpload = createUploader(VIDEO_MIME_TYPES, 20 * 1024 * 1024); // 20MB videos
const docxUpload = createUploader(DOCX_MIME_TYPES, 5 * 1024 * 1024, diskStorage); // 5MB docx

// Combined uploader for products (images + video)
const mediaUpload = createUploader(new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES]), 25 * 1024 * 1024);

module.exports = {
  upload,
  videoUpload,
  docxUpload,
  mediaUpload,
};