const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const Coupon = require("../models/coupon.model");

const seedCoupons = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected for seeding...");

    const coupons = [
      {
        code: "WELCOME10",
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: 500,
        expiryDate: new Date("2026-12-31"),
        usageLimit: 100,
        isActive: true
      },
      {
        code: "FLAT100",
        discountType: "fixed",
        discountValue: 100,
        minOrderAmount: 1000,
        expiryDate: new Date("2025-12-31"),
        usageLimit: 50,
        isActive: true
      },
      {
        code: "EXPIRED",
        discountType: "percentage",
        discountValue: 20,
        minOrderAmount: 0,
        expiryDate: new Date("2020-01-01"),
        usageLimit: 10,
        isActive: true
      }
    ];

    for (const c of coupons) {
      await Coupon.findOneAndUpdate({ code: c.code }, c, { upsert: true, new: true });
    }

    console.log("Coupons seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

seedCoupons();
