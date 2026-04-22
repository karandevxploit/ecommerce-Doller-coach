const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/user.model");

const args = process.argv.slice(2);

const isForce = args.includes("--force");
const isDryRun = args.includes("--dry-run");

const ENV = process.env.NODE_ENV || "development";

if (ENV === "production" && !isForce) {
  console.error("❌ BLOCKED: Cannot run in production without --force");
  process.exit(1);
}

async function hardResetProviders() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`🔍 Running provider fix in ${ENV} mode`);

    /**
     * FIND INVALID PROVIDERS ONLY
     */
    const invalidUsers = await User.find({
      provider: { $nin: ["email", "google", "github"] }
    })
      .select("_id provider email")
      .lean();

    console.log(`⚠️ Found ${invalidUsers.length} users with invalid provider`);

    if (isDryRun) {
      console.log("🧪 DRY RUN - No changes applied");
      console.log(JSON.stringify(invalidUsers.slice(0, 10), null, 2));
      return;
    }

    if (!isForce) {
      console.error("❌ Use --force to apply changes or --dry-run to preview");
      process.exit(1);
    }

    /**
     * SAFE UPDATE
     */
    const res = await User.updateMany(
      { provider: { $nin: ["email", "google", "github"] } },
      { $set: { provider: "email" } }
    );

    console.log(`✅ Updated ${res.modifiedCount} invalid provider users`);

    /**
     * OPTIONAL AUDIT LOG
     */
    const fs = require("fs");
    fs.writeFileSync(
      `provider_fix_log_${Date.now()}.json`,
      JSON.stringify(invalidUsers, null, 2)
    );

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

hardResetProviders();