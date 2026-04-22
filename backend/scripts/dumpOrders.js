const mongoose = require("mongoose");
require("dotenv").config();

const Order = require("../models/order.model");

const TIMEOUT = 5000;

/**
 * CLI ARG PARSER
 */
const args = process.argv.slice(2);

const getArg = (key, def) => {
    const arg = args.find(a => a.startsWith(`--${key}=`));
    return arg ? arg.split("=")[1] : def;
};

const limit = Number(getArg("limit", 5));
const status = getArg("status", null);

/**
 * TIMEOUT WRAPPER
 */
const withTimeout = (promise, label) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout`)), TIMEOUT)
        ),
    ]);
};

/**
 * SAFE FORMATTER
 */
const formatOrder = (o) => ({
    id: o._id,
    subtotal: o.subtotal ?? 0,
    gst: o.gst ?? 0,
    total: o.total ?? 0,
    status: o.status ?? "unknown",
    createdAt: o.createdAt,
});

async function dump() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI missing");
        }

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            maxPoolSize: 5,
        });

        console.log("🔍 Running Order Dump...");

        const query = {};
        if (status) query.status = status;

        const start = Date.now();

        /**
         * SAFE QUERY
         */
        const orders = await withTimeout(
            Order.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .select("subtotal gst total status createdAt")
                .lean(),
            "Order Query"
        );

        const latency = Date.now() - start;

        if (!orders.length) {
            console.log("⚠️ No orders found");
            return;
        }

        console.log(`📦 Dumping ${orders.length} orders:\n`);

        orders.forEach(o => {
            const safe = formatOrder(o);
            console.log(
                `ID: ${safe.id} | Total: ${safe.total} | Status: ${safe.status} | Date: ${safe.createdAt}`
            );
        });

        console.log(`\n⏱ Query latency: ${latency}ms`);

        /**
         * JSON OUTPUT (CI SUPPORT)
         */
        if (process.env.JSON === "true") {
            console.log(JSON.stringify(orders.map(formatOrder), null, 2));
        }

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(0);
    }
}

dump();