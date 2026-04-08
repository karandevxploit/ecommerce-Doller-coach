const path = require("path");
// Ensure .env is loaded from the root backend folder
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { v2: cloudinary } = require("cloudinary");

// Use manual config properties as requested
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
