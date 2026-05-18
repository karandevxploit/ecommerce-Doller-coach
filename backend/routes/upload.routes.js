const router = require("express").Router();

const { requireAdmin } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { upload, videoUpload } = require("../middlewares/upload.middleware");
const {
  uploadSingle,
  uploadMultiple,
  uploadVideo,
} = require("../controllers/upload.controller");

router.post(
  "/single",
  requireAdmin,
  authLimiter,
  upload.single("image"),
  uploadSingle
);

router.post(
  "/multiple",
  requireAdmin,
  authLimiter,
  upload.array("images", 10),
  uploadMultiple
);

router.post(
  "/video",
  requireAdmin,
  authLimiter,
  videoUpload.single("video"),
  uploadVideo
);

module.exports = router;
