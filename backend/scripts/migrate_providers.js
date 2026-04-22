const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/user.model");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

const ENV = process.env.NODE_ENV || "development";

if (ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force to run in production");
  process.exit(1);
}

async function migrate() {
  let session;

  try {
    console.log(`🔍 Running migration in ${ENV} mode`);

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });

    session = await mongoose.startSession();
    session.startTransaction();

    /**
     * 1. FIX INVALID PROVIDERS ONLY
     */
    const invalidUsers = await User.find({
      provider: { $nin: ["email", "google", "github"] }
    })
      .select("_id provider email")
      .lean();

    console.log(`⚠️ Found ${invalidUsers.length} invalid provider users`);

    /**
     * 2. SAFE UPDATE
     */
    let providerUpdateCount = 0;

    if (!DRY_RUN) {
      const res = await User.updateMany(
        { provider: { $nin: ["email", "google", "github"] } },
        { $set: { provider: "email" } },
        { session }
      );
      providerUpdateCount = res.modifiedCount;
    }

    /**
     * 3. ADMIN NORMALIZATION (STRICT)
     */
    const validAdmins = await User.find({
      role: "admin"
    })
      .select("_id role")
      .lean();

    let adminUpdateCount = 0;

    if (!DRY_RUN) {
      const res = await User.updateMany(
        { role: "admin" },
        { $set: { isAdmin: true } },
        { session }
      );
      adminUpdateCount = res.modifiedCount;
    }

    /**
     * COMMIT / ROLLBACK
     */
    if (DRY_RUN) {
      console.log("🧪 DRY RUN - No changes applied");
      await session.abortTransaction();
    } else {
      await session.commitTransaction();
      console.log("🎉 Migration committed");
    }

    /**
     * AUDIT LOG
     */
    fs.writeFileSync(
      `user_migration_log_${Date.now()}.json`,
      JSON.stringify({
        invalidUsers: invalidUsers.slice(0, 100),
        providerUpdateCount,
        adminUpdateCount
      }, null, 2)
    );

    console.log(`Updated providers: ${providerUpdateCount}`);
    console.log(`Updated admins: ${adminUpdateCount}`);

  } catch (err) {
    if (session) await session.abortTransaction();
    console.error("❌ Migration failed:", err.message);
  } finally {
    if (session) session.endSession();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

migrate();