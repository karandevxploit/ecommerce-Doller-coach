const mongoose = require("mongoose");
require("dotenv").config();
const fs = require("fs");

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

const reconcile = async () => {
    try {
        if (!process.env.MONGO_URI) throw new Error("MONGO_URI not found");

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10
        });

        const Order = require("../models/order.model");

        console.log("🚀 Starting SAFE GST Reconciliation...\n");

        const cursor = Order.find({
            subtotal: { $exists: true },
            paymentStatus: { $ne: "PAID" },          // 🔥 CRITICAL SAFETY
            reconciliationVersion: { $ne: 1 }
        }).cursor();

        let bulkOps = [];
        let processed = 0;
        let updated = 0;

        const audit = [];

        for await (const order of cursor) {
            processed++;

            const subtotal = Number(order.subtotal || 0);
            const discount = Number(order.discount || 0);

            const gstPercent = order.gstPercent ?? 18;
            const expectedGst = Math.round((subtotal * gstPercent) / 100);

            const expectedTotal = subtotal - discount + expectedGst + (order.delivery || 0);

            if (
                order.gst === expectedGst &&
                order.total === expectedTotal
            ) {
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: order._id },
                    update: {
                        $set: {
                            gst: expectedGst,
                            total: expectedTotal,
                            reconciliationVersion: 1
                        }
                    }
                }
            });

            audit.push({
                id: order._id,
                old: { gst: order.gst, total: order.total },
                new: { gst: expectedGst, total: expectedTotal }
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
            `gst_reconciliation_${Date.now()}.json`,
            JSON.stringify(audit.slice(0, 1000), null, 2)
        );

        console.log(`Processed: ${processed}`);
        console.log(`Updated: ${updated}`);
        console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error("❌ CRITICAL ERROR:", err.message);
        process.exit(1);
    }
};

reconcile();