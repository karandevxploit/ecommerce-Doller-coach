const mongoose = require("mongoose");
const Order = require("./models/order.model");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, ".env") });

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

function normalizePhone(phone = "") {
  const match = phone.match(/\b(\+91)?\d{10}\b/);
  if (!match) return "";

  let num = match[0];
  if (num.startsWith("+91")) num = num.slice(3);

  return num;
}

function buildUpdate(order) {
  if (!order.address) return null;

  const parts = order.address.split("|").map(s => s.trim());
  if (parts.length < 2) return null;

  const name = parts[0];
  const phone = normalizePhone(parts[1]);
  const address = parts.slice(2).join(", ");

  const update = {};

  if (!order.shippingAddress?.name && name) {
    update["shippingAddress.name"] = name;
  }

  if (!order.shippingAddress?.phone && phone) {
    update["shippingAddress.phone"] = phone;
  }

  if (!order.shippingAddress?.address && address) {
    update["shippingAddress.address"] = address;
  }

  return Object.keys(update).length ? update : null;
}

async function migrateOrdersSplit() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });

  console.log("🚀 Starting safe '|' split migration...\n");

  const cursor = Order.find({
    address: { $regex: /\|/ }
  }).cursor();

  let bulkOps = [];
  let processed = 0;
  let updated = 0;
  const audit = [];

  for await (const order of cursor) {
    processed++;

    const updateFields = buildUpdate(order);
    if (!updateFields) continue;

    bulkOps.push({
      updateOne: {
        filter: { _id: order._id },
        update: { $set: updateFields }
      }
    });

    audit.push({
      id: order._id,
      applied: updateFields
    });

    if (bulkOps.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        const res = await Order.bulkWrite(bulkOps);
        updated += res.modifiedCount;
      }
      bulkOps = [];
    }
  }

  if (bulkOps.length && !DRY_RUN) {
    const res = await Order.bulkWrite(bulkOps);
    updated += res.modifiedCount;
  }

  fs.writeFileSync(
    `split_migration_log_${Date.now()}.json`,
    JSON.stringify(audit.slice(0, 1000), null, 2)
  );

  console.log(`\nProcessed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  await mongoose.connection.close();
}

migrateOrdersSplit().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});