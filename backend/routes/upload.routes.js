const router = require("express").Router();
const path = require("path");

const { safeHandler } = require("../middlewares/error.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
    upload,
    videoUpload,
} = require("../middlewares/upload.middleware");

const {
    uploadSingle,
    uploadMultiple,
    uploadVideo,
} = require("../controllers/upload.controller");

/**
 * FILE TYPE VALIDATION
 */
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedVideoTypes = ["video/mp4", "video/mpeg", "video/quicktime"];

const validateImage = (req, res, next) => {
    if (req.file && !allowedImageTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            message: "Invalid image format",
        });
    }
    next();
};

const validateMultipleImages = (req, res, next) => {
    if (req.files) {
        for (const file of req.files) {
            if (!allowedImageTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image format in upload",
                });
            }
        }
    }
    next();
};

const validateVideo = (req, res, next) => {
    if (req.file && !allowedVideoTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            message: "Invalid video format",
        });
    }
    next();
};

/**
 * DEBUG MIDDLEWARE
 */
router.use((req, res, next) => {
    if (req.method === "POST") {
        logger.info("[UPLOAD_TRACE] Incoming request", {
            url: req.originalUrl,
            contentType: req.headers["content-type"],
        });
    }
    next();
});

/**
 * SINGLE IMAGE UPLOAD
 */
router.post(
    "/single",
    requireAdmin,
    authLimiter,
    upload.single("files"),
    validateImage,
    safeHandler(async (req, res, next) => {
        try {
            const result = await uploadSingle(req, res);

            logger.info("UPLOAD_SINGLE", {
                adminId: req.user?.id,
                file: req.file?.originalname,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("UPLOAD_SINGLE_FAILED", {
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * MULTIPLE IMAGE UPLOAD
 */
router.post(
    "/multiple",
    requireAdmin,
    authLimiter,
    upload.array("files", 10),
    validateMultipleImages,
    safeHandler(async (req, res, next) => {
        try {
            const result = await uploadMultiple(req, res);

            logger.info("UPLOAD_MULTIPLE", {
                adminId: req.user?.id,
                count: req.files?.length,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("UPLOAD_MULTIPLE_FAILED", {
                error: err.message,
            });
            next(err);
        }
    })
);

/**
 * VIDEO UPLOAD
 */
router.post(
    "/video",
    requireAdmin,
    authLimiter,
    videoUpload.single("video"),
    validateVideo,
    safeHandler(async (req, res, next) => {
        try {
            const result = await uploadVideo(req, res);

            logger.info("UPLOAD_VIDEO", {
                adminId: req.user?.id,
                file: req.file?.originalname,
            });

            if (!res.headersSent) {
                res.json({ success: true, data: result });
            }
        } catch (err) {
            logger.error("UPLOAD_VIDEO_FAILED", {
                error: err.message,
            });
            next(err);
        }
    })
);

module.exports = router;