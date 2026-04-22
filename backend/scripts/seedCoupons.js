const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const Coupon = require("../models/coupon.model");

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force to run in production");
  process.exit(1);
}

const coupons = [
  {
    code: "WELCOME10",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 500,
    startDate: new Date(),
    endDate: new Date("2026-12-31"),
    usageLimit: 100,
    isActive: true
  },
  {
    code: "FLAT100",
    discountType: "fixed",
    discountValue: 100,
    minOrderAmount: 1000,
    startDate: new Date(),
    endDate: new Date("2025-12-31"),
    usageLimit: 50,
    isActive: true
  },
  {
    code: "EXPIRED",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 0,
    startDate: new Date("2019-01-01"),
    endDate: new Date("2020-01-01"),
    usageLimit: 10,
    isActive: false // 🔥 FIXED
  }
];

const seedCoupons = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log("🚀 Seeding Coupons...");

    const bulkOps = coupons.map(c => {
      const normalizedCode = c.code.toUpperCase().trim();

      // Validation
      if (c.discountType === "percentage" && c.discountValue > 100) {
        throw new Error(`Invalid % for ${normalizedCode}`);
      }

      return {
        updateOne: {
          filter: { code: normalizedCode },
          update: {
            $setOnInsert: {
              usedCount: 0
            },
            $set: {
              ...c,
              code: normalizedCode
            }
          },
          upsert: true
        }
      };
    });

    if (DRY_RUN) {
      console.log("🧪 DRY RUN:", JSON.stringify(bulkOps, null, 2));
      process.exit(0);
    }

    const res = await Coupon.bulkWrite(bulkOps);

    console.log(`✅ Coupons seeded`);
    console.log(`Upserted: ${res.upsertedCount}`);
    console.log(`Modified: ${res.modifiedCount}`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
};

seedCoupons();