const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
});

const videoUpload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
});

module.exports = { upload, videoUpload };
