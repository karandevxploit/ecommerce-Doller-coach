const router = require("express").Router();
const { upload, videoUpload } = require("../middlewares/upload.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");
const { uploadSingle, uploadMultiple, uploadVideo } = require("../controllers/upload.controller");

router.post("/single", requireAdmin, upload.single("image"), uploadSingle);
router.post("/multiple", requireAdmin, upload.array("images", 500), uploadMultiple);
router.post("/video", requireAdmin, videoUpload.single("video"), uploadVideo);

module.exports = router;
