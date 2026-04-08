const cloudinary = require("../config/cloudinary");
const { ok, fail } = require("../utils/apiResponse");

/**
 * Upload single image to Cloudinary via stream
 */
exports.uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, "No file uploaded", 400);
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: "products" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Single Upload Error:", error);
          return fail(res, "Upload failed", 500);
        }
        return ok(res, { imageUrl: result.secure_url }, "");
      }
    );

    stream.end(req.file.buffer);
  } catch (error) {
    console.error("Upload Single Error:", error);
    return fail(res, "Server error during upload", 500);
  }
};

/**
 * Upload multiple images to Cloudinary via stream
 */
exports.uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return fail(res, "No files received", 400);
    }

    const urls = [];

    for (const [index, file] of req.files.entries()) {
      if (!file.buffer) {
        throw new Error(`File buffer missing for file ${index + 1}`);
      }

      const b64 = file.buffer.toString("base64");
      const dataURI = `data:${file.mimetype};base64,${b64}`;
      
      try {
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: "products",
          resource_type: "auto",
          timeout: 60000 // 60 seconds timeout
        });

        urls.push(result.secure_url);
      } catch (cloudinaryErr) {
        throw new Error(`Cloudinary upload failed: ${cloudinaryErr.message}`);
      }
    }

    return ok(res, { images: urls }, "");
  } catch (error) {
    console.error("FINAL UPLOAD ERROR:", error);
    return fail(res, error.message || "Internal server error", 500);
  }
};

/**
 * Upload one product video to Cloudinary
 */
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) return fail(res, "No video uploaded", 400);
    const b64 = req.file.buffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "products/videos",
      resource_type: "video",
      timeout: 120000,
    });
    return ok(res, { videoUrl: result.secure_url }, "");
  } catch (error) {
    console.error("uploadVideo:", error);
    return fail(res, error.message || "Video upload failed", 500);
  }
};
