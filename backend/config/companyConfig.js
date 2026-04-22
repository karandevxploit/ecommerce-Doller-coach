const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// ---------- VALIDATION HELPERS ----------
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone) =>
  /^[0-9]{10}$/.test(phone);

const isValidGST = (gst) =>
  /^[0-9A-Z]{15}$/.test(gst);

// ---------- CONFIG BUILD ----------
const config = {
  logo: process.env.COMPANY_LOGO_URL,
  company_name: process.env.COMPANY_NAME,
  phone: process.env.COMPANY_PHONE,
  email: process.env.COMPANY_EMAIL,
  gst: process.env.COMPANY_GST,
};

// ---------- FAIL-FAST VALIDATION ----------
if (!config.logo) throw new Error("❌ Missing COMPANY_LOGO_URL");
if (!config.company_name) throw new Error("❌ Missing COMPANY_NAME");

if (!isValidPhone(config.phone)) {
  throw new Error("❌ Invalid COMPANY_PHONE");
}

if (!isValidEmail(config.email)) {
  throw new Error("❌ Invalid COMPANY_EMAIL");
}

if (!isValidGST(config.gst)) {
  throw new Error("❌ Invalid COMPANY_GST");
}

// ---------- IMMUTABILITY ----------
Object.freeze(config);

// ---------- SAFE ACCESSOR ----------
const getCompanyConfig = () => config;

module.exports = {
  getCompanyConfig,
};