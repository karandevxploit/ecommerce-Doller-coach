const mongoose = require("mongoose");
const Order = require("./models/order.model");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, ".env") });

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

function extractPhone(str = "") {
  const match = str.match(/\b\d{10}\b/);
  return match ? match[0] : "";
}

function safeParse(order) {
  let result = {
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  };

  const raw = order.address || "";

  if (raw.includes("|")) {
    const parts = raw.split("|").map(s => s.trim());
    result.name = parts[0] || "";
    result.phone = extractPhone(parts[1] || "");
    result.address = parts[2] || "";
  } else {
    const parts = raw.split(",").map(s => s.trim());
    result.name = parts[0] || "";
    result.phone = extractPhone(parts[0] || "");
    result.address = parts[1] || "";
    result.city = parts[2] || "";
  }

  return result;
}

async function migrateAddressStructure() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  });

  console.log("🚀 Starting safe migration...");

  const cursor = Order.find({
    $or: [
      { "shippingAddress.phone": { $exists: false } },
      { "shippingAddress.phone": null },
      { "shippingAddress.phone": "" }
    ]
  }).cursor();

  let bulkOps = [];
  let processed = 0;
  let updated = 0;
  const auditLog = [];

  for await (const order of cursor) {
    processed++;

    const parsed = safeParse(order);

    if (!parsed.phone) continue;

    bulkOps.push({
      updateOne: {
        filter: { _id: order._id },
        update: {
          $set: {
            "shippingAddress.fullName": parsed.name || order.shippingAddress?.fullName || "",
            "shippingAddress.phone": parsed.phone,
            "shippingAddress.addressLine1": parsed.address || "",
            "shippingAddress.city": parsed.city || "",
            "shippingAddress.state": parsed.state || "",
            "shippingAddress.pincode": parsed.pincode || ""
          }
        }
      }
    });

    auditLog.push({
      id: order._id,
      old: order.address,
      new: parsed
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
    `migration_audit_${Date.now()}.json`,
    JSON.stringify(auditLog.slice(0, 1000), null, 2)
  );

  console.log(`\nProcessed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  await mongoose.connection.close();
}

migrateAddressStructure().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});