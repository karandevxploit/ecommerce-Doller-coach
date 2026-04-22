const mongoose = require("mongoose");
const Order = require("./models/order.model");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, ".env") });

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

function extractPhone(str = "") {
  const match = str.match(/\b(\+91)?\d{10}\b/);
  if (!match) return "";

  let phone = match[0];

  // normalize
  if (phone.startsWith("+91")) {
    phone = phone.slice(3);
  }

  return phone;
}

function buildUpdate(order) {
  const addressStr = order.address || "";

  const phone = extractPhone(addressStr);

  const parts = addressStr.split(",").map(s => s.trim());

  const update = {};

  if (!order.shippingAddress?.phone && phone) {
    update["shippingAddress.phone"] = phone;
  }

  if (!order.shippingAddress?.address && addressStr) {
    update["shippingAddress.address"] = addressStr;
  }

  if (!order.shippingAddress?.name && parts[0]) {
    update["shippingAddress.name"] = parts[0];
  }

  return update;
}

async function migrateOrders() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });

  console.log("🚀 Starting safe order migration...\n");

  const cursor = Order.find({
    $or: [
      { "shippingAddress.phone": { $exists: false } },
      { "shippingAddress.phone": "" },
      { "shippingAddress.address": { $exists: false } }
    ]
  }).cursor();

  let bulkOps = [];
  let processed = 0;
  let updated = 0;

  const audit = [];

  for await (const order of cursor) {
    processed++;

    const updateFields = buildUpdate(order);

    if (Object.keys(updateFields).length === 0) continue;

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
    `order_migration_log_${Date.now()}.json`,
    JSON.stringify(audit.slice(0, 1000), null, 2)
  );

  console.log(`\nProcessed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  await mongoose.connection.close();
}

migrateOrders().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});