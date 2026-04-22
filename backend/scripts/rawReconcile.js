const { MongoClient } = require("mongodb");
require("dotenv").config();
const fs = require("fs");

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes("--dry-run");

const rawFix = async () => {
    const client = new MongoClient(process.env.MONGO_URI, {
        maxPoolSize: 10
    });

    try {
        await client.connect();
        const db = client.db();
        const collection = db.collection("orders");

        console.log("🚀 Starting SAFE Financial Reconciliation...");

        const cursor = collection.find({
            subtotal: { $gt: 0 },
            paymentStatus: { $ne: "PAID" }, // 🔥 CRITICAL SAFETY
            reconciliationVersion: { $ne: 1 }
        });

        let bulkOps = [];
        let processed = 0;
        let updated = 0;

        const audit = [];

        for await (const order of cursor) {
            processed++;

            const subtotal = order.subtotal || 0;
            const discount = order.discount || 0;

            // safer GST handling
            const gstPercent = order.gstPercent ?? 18;
            const expectedGst = Math.round((subtotal * gstPercent) / 100);

            const expectedTotal = subtotal - discount + expectedGst;

            if (
                order.gst === expectedGst &&
                order.total === expectedTotal &&
                order.delivery === 0
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
                            delivery: 0,
                            subtotal,
                            discount,
                            reconciliationVersion: 1
                        },
                        $unset: {
                            gstAmount: "",
                            totalAmount: "",
                            subtotalAmount: "",
                            deliveryFee: ""
                        }
                    }
                }
            });

            audit.push({
                id: order._id,
                old: {
                    gst: order.gst,
                    total: order.total
                },
                new: {
                    gst: expectedGst,
                    total: expectedTotal
                }
            });

            if (bulkOps.length >= BATCH_SIZE) {
                if (!DRY_RUN) {
                    const res = await collection.bulkWrite(bulkOps);
                    updated += res.modifiedCount;
                }
                bulkOps = [];
            }
        }

        if (bulkOps.length && !DRY_RUN) {
            const res = await collection.bulkWrite(bulkOps);
            updated += res.modifiedCount;
        }

        fs.writeFileSync(
            `financial_reconciliation_${Date.now()}.json`,
            JSON.stringify(audit.slice(0, 1000), null, 2)
        );

        console.log(`Processed: ${processed}`);
        console.log(`Updated: ${updated}`);
        console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

        await client.close();
        process.exit(0);

    } catch (err) {
        console.error("❌ FATAL ERROR:", err.message);
        process.exit(1);
    }
};

rawFix();