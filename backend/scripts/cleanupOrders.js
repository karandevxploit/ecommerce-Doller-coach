const mongoose = require("mongoose");
require("dotenv").config();

const Order = require("../models/order.model");

const args = process.argv.slice(2);

/**
 * FLAGS
 */
const isForce = args.includes("--force");
const isDryRun = args.includes("--dry-run");

/**
 * ENV PROTECTION
 */
const ENV = process.env.NODE_ENV || "development";

if (ENV === "production" && !isForce) {
    console.error("❌ BLOCKED: Cannot run cleanup in production without --force");
    process.exit(1);
}

/**
 * CONFIRMATION
 */
if (!isForce) {
    console.error(
        "⚠️ This will delete ALL orders.\nUse --force to confirm or --dry-run to preview."
    );
    process.exit(1);
}

/**
 * TIMEOUT WRAPPER
 */
const withTimeout = (promise, ms = 10000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Operation timeout")), ms)
        ),
    ]);
};

async function cleanDB() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI not found");
        }

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000,
        });

        console.log(`🔍 Running cleanup in ${ENV} mode`);

        /**
         * COUNT FIRST
         */
        const total = await withTimeout(Order.countDocuments());
        console.log(`📊 Total Orders: ${total}`);

        if (isDryRun) {
            console.log("🧪 Dry run complete. No data deleted.");
            return;
        }

        /**
         * FINAL CONFIRMATION
         */
        console.log("⚠️ Proceeding with deletion...");

        const start = Date.now();

        const result = await withTimeout(Order.deleteMany({}));

        const latency = Date.now() - start;

        console.log(`✅ CLEANUP COMPLETE`);
        console.log({
            deleted: result.deletedCount,
            durationMs: latency,
        });

    } catch (err) {
        console.error("❌ CLEANUP ERROR:", err.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(0);
    }
}

cleanDB();