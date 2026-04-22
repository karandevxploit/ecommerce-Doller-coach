const path = require("path");
const { v2: cloudinary } = require("cloudinary");

// ---------- ENV LOADING (Fail Fast) ----------
const envPath = path.join(__dirname, "..", ".env");
const result = require("dotenv").config({ path: envPath });

if (result.error) {
  throw new Error(`❌ .env load failed at ${envPath}`);
}

// ---------- ENV VALIDATION ----------
const requiredEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing ENV: ${key}`);
  }
}

// ---------- CLOUDINARY CONFIG ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- IMMUTABILITY (Prevent Mutation Bugs) ----------
Object.freeze(cloudinary);

// ---------- SAFE EXPORT WRAPPER ----------
const getCloudinary = () => cloudinary;

// ---------- HEALTH CHECK (Non-blocking Safe) ----------
const verifyCloudinary = async () => {
  try {
    await cloudinary.api.ping();
    console.log("✅ Cloudinary Connected");
  } catch (err) {
    console.error("❌ Cloudinary Connection Failed:", err.message);
    process.exit(1); // Hard fail → no broken server
  }
};

module.exports = {
  getCloudinary,
  verifyCloudinary,
};