const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Offer = require("../models/offer.model");

const LIMIT = parseInt(process.argv[2]) || 10;
const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force in production");
  process.exit(1);
}

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log("🚀 Checking Offers...\n");

    // Total count
    const total = await Offer.countDocuments();
    console.log(`📊 Total Offers: ${total}`);

    // Active offers
    const activeCount = await Offer.countDocuments({ isActive: true });
    console.log(`✅ Active Offers: ${activeCount}`);

    // Sample data (safe)
    const sample = await Offer.find()
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .select("title discountType discountValue isActive startDate endDate")
      .lean();

    console.log(`\n📦 Showing latest ${LIMIT} offers:\n`);
    console.table(sample);

    // Expired offers
    const expiredCount = await Offer.countDocuments({
      endDate: { $lt: new Date() }
    });
    console.log(`\n⏳ Expired Offers: ${expiredCount}`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

check();