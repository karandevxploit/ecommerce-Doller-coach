const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/user.model");

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

const VALID_ROLES = ["user", "admin"];

async function normalizeRoles() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });

  console.log("🚀 Starting role normalization...\n");

  const cursor = User.find({}).cursor();

  let bulkOps = [];
  let processed = 0;
  let updated = 0;

  const audit = [];

  for await (const user of cursor) {
    processed++;

    const oldRole = user.role || "user";
    const newRole = String(oldRole).toLowerCase().trim();

    if (!VALID_ROLES.includes(newRole)) continue;
    if (oldRole === newRole) continue;

    bulkOps.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { role: newRole } }
      }
    });

    audit.push({
      id: user._id,
      from: oldRole,
      to: newRole
    });

    if (bulkOps.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        const res = await User.bulkWrite(bulkOps);
        updated += res.modifiedCount;
      }
      bulkOps = [];
    }
  }

  if (bulkOps.length && !DRY_RUN) {
    const res = await User.bulkWrite(bulkOps);
    updated += res.modifiedCount;
  }

  fs.writeFileSync(
    `role_migration_log_${Date.now()}.json`,
    JSON.stringify(audit.slice(0, 1000), null, 2)
  );

  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  await mongoose.connection.close();
}

normalizeRoles().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});