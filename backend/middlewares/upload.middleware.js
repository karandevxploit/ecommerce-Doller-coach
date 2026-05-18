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
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = new Map([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/jpg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/webp", new Set([".webp"])],
  ["image/avif", new Set([".avif"])],
  ["video/mp4", new Set([".mp4"])],
  ["video/webm", new Set([".webm"])],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    new Set([".docx"]),
  ],
]);

// Ensure directory exists (sync-safe for multer diskStorage callbacks)
const ensureDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch (err) {
    logger.error("Upload dir creation failed", { error: err.message });
    return false;
  }
};

const safeOriginalName = (name = "") =>
  path.basename(String(name || "file")).replace(/[^\w.\- ]+/g, "_").slice(0, 120);

const buildSafeFilename = (prefix, originalName) => {
  const ext = path.extname(originalName || "").toLowerCase();
  const random = crypto.randomBytes(8).toString("hex");
  return `${prefix}-${Date.now()}-${random}${ext}`;
};

// File filter (security gate)
const fileFilter = (allowedTypes) => (req, file, cb) => {
  try {
    const requestId = getRequestId?.(req) || "unknown";
    const mimetype = String(file.mimetype || "").toLowerCase();
    const originalName = safeOriginalName(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS.get(mimetype);

    if (!allowedTypes.has(mimetype) || !allowedExtensions?.has(ext)) {
      logger.warn("Blocked file upload (invalid MIME)", {
        requestId,
        mimetype,
        filename: originalName,
      });
      return cb(new Error("Invalid file type"), false);
    }

    file.originalname = originalName;
    file.mimetype = mimetype;
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
    if (!ensureDir(dir)) return cb(new Error("Upload storage is not ready"));
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, buildSafeFilename("template", file.originalname));
  }
});

const getUploadSubdir = (file) => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const isVideo = VIDEO_MIME_TYPES.has(String(file?.mimetype || "").toLowerCase());
  return path.join(isVideo ? "videos" : "images", year, month);
};

// Disk storage for media (/uploads folder)
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", getUploadSubdir(file));
    if (!ensureDir(dir)) return cb(new Error("Upload storage is not ready"));
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const isVideo = VIDEO_MIME_TYPES.has(String(file?.mimetype || "").toLowerCase());
    cb(null, buildSafeFilename(isVideo ? "video" : "image", file.originalname));
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
      fields: 30,
      fieldNameSize: 100,
      fieldSize: 64 * 1024,
      parts: 40,
    },
  });

// Upload instances
const upload = createUploader(IMAGE_MIME_TYPES, 5 * 1024 * 1024, mediaStorage); // 5MB images (local disk)
const videoUpload = createUploader(VIDEO_MIME_TYPES, 20 * 1024 * 1024, mediaStorage); // 20MB videos
const docxUpload = createUploader(DOCX_MIME_TYPES, 5 * 1024 * 1024, diskStorage); // 5MB docx

// Combined uploader for products (images + video)
const mediaUpload = createUploader(new Set([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES]), 25 * 1024 * 1024, mediaStorage);

module.exports = {
  upload,
  videoUpload,
  docxUpload,
  mediaUpload,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  DOCX_MIME_TYPES,
  fileFilter,
};
