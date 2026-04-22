const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const User = require("../models/user.model");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force to run in production");
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.env.ADMIN_PASSWORD || "ChangeMe@123";

    console.log("🚀 Admin seeding started...");

    let user = await User.findOne({ email });

    if (user) {
      console.log("⚠️ Admin exists. Updating role only...");

      user.role = "admin";
      user.isAdmin = true;
      user.emailVerified = true;
      user.phoneVerified = true;
      user.isVerified = true;

      await user.save(); // hooks safe
    } else {
      console.log("🆕 Creating admin user...");

      user = new User({
        name: "Admin",
        email,
        password, // ⚠️ plain password, hook will hash
        role: "admin",
        isAdmin: true,
        emailVerified: true,
        phoneVerified: true,
        isVerified: true,
      });

      await user.save();
    }

    console.log(`✅ Admin ready: ${email}`);
    console.log("⚠️ Change password immediately after first login.");

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Admin seed error:", err);
    process.exit(1);
  }
}

run();