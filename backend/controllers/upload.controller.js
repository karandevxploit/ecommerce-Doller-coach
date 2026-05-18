const path = require("path");
const asyncHandler = require("express-async-handler");

const { ok, fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

const normalizeSlash = (value = "") => String(value || "").replace(/\\/g, "/");

const getPublicBaseUrl = (req) => {
  const configured =
    process.env.PUBLIC_BACKEND_URL ||
    process.env.BASE_URL ||
    process.env.BACKEND_URL ||
    "";

  if (configured) {
    return String(configured).replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }

  if (!req) return "";

  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "";

  return host ? `${protocol}://${host}` : "";
};

const toUploadUrl = (file = {}) => {
  if (!file.path) return "";

  const uploadsRoot = normalizeSlash(path.resolve(__dirname, "..", "uploads"));
  const filePath = normalizeSlash(path.resolve(file.path));
  const relativePath = filePath.startsWith(uploadsRoot)
    ? filePath.slice(uploadsRoot.length).replace(/^\/+/, "")
    : path.basename(filePath);

  return `/uploads/${relativePath}`;
};

const isImage = (file) => ALLOWED_IMAGE_TYPES.has(file?.mimetype);
const isVideo = (file) => ALLOWED_VIDEO_TYPES.has(file?.mimetype);

const validateFile = (file, kind = "image") => {
  if (!file) return "No file uploaded";

  const allowed = kind === "video" ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  const maxSize = kind === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (!allowed.has(file.mimetype)) {
    return kind === "video" ? "Only MP4/WebM videos allowed" : "Only JPG, PNG, WebP or AVIF images allowed";
  }

  if (Number(file.size || 0) > maxSize) {
    return `File too large (max ${Math.round(maxSize / (1024 * 1024))}MB)`;
  }

  if (!file.path) {
    return "Upload was not saved locally";
  }

  return null;
};

const normalizeUploadResult = (file = {}, kind = "image", req = null) => {
  const url = toUploadUrl(file);
  const baseUrl = getPublicBaseUrl(req);
  const publicUrl = baseUrl && url ? `${baseUrl}${url}` : url;

  return {
    url,
    publicUrl,
    absoluteUrl: publicUrl,
    imageUrl: kind === "image" ? url : undefined,
    videoUrl: kind === "video" ? url : undefined,
    secure_url: publicUrl,
    public_id: file.filename || "",
    publicId: file.filename || "",
    width: null,
    height: null,
    duration: null,
    size: file.size || 0,
    format: path.extname(file.originalname || file.filename || "").replace(".", "").toLowerCase(),
    originalName: file.originalname || "",
    storage: "local",
  };
};

const uploadImageFile = async (file, req = null) => {
  const error = validateFile(file, "image");
  if (error) {
    const err = new Error(error);
    err.statusCode = 400;
    throw err;
  }

  return normalizeUploadResult(file, "image", req);
};

const uploadVideoFile = async (file, req = null) => {
  const error = validateFile(file, "video");
  if (error) {
    const err = new Error(error);
    err.statusCode = 400;
    throw err;
  }

  return normalizeUploadResult(file, "video", req);
};

exports.uploadSingle = asyncHandler(async (req, res) => {
  try {
    const uploaded = await uploadImageFile(req.file, req);
    logger.info("[UPLOAD_SINGLE_LOCAL_SUCCESS]", { file: uploaded.public_id, size: uploaded.size });

    return ok(res, uploaded, "Image uploaded locally");
  } catch (err) {
    logger.error("[UPLOAD_SINGLE_LOCAL_ERROR]", { message: err.message });
    return fail(res, err.message || "Upload failed", err.statusCode || 500);
  }
});

exports.uploadMultiple = asyncHandler(async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return fail(res, "No files uploaded", 400);
    if (files.length > 10) return fail(res, "Maximum 10 images allowed", 400);

    const uploads = await Promise.all(files.map((file) => uploadImageFile(file, req)));
    const urls = uploads.map((item) => item.url).filter(Boolean);

    logger.info("[UPLOAD_MULTIPLE_LOCAL_SUCCESS]", { count: uploads.length });

    return ok(
      res,
      {
        images: uploads,
        files: uploads,
        urls,
      },
      "Images uploaded locally"
    );
  } catch (err) {
    logger.error("[UPLOAD_MULTIPLE_LOCAL_ERROR]", { message: err.message });
    return fail(res, err.message || "Upload failed", err.statusCode || 500);
  }
});

exports.uploadVideo = asyncHandler(async (req, res) => {
  try {
    const uploaded = await uploadVideoFile(req.file, req);
    logger.info("[UPLOAD_VIDEO_LOCAL_SUCCESS]", { file: uploaded.public_id, size: uploaded.size });

    return ok(res, uploaded, "Video uploaded locally");
  } catch (err) {
    logger.error("[UPLOAD_VIDEO_LOCAL_ERROR]", { message: err.message });
    return fail(res, err.message || "Video upload failed", err.statusCode || 500);
  }
});

exports._private = {
  isImage,
  isVideo,
  validateFile,
  normalizeUploadResult,
  toUploadUrl,
  getPublicBaseUrl,
};
