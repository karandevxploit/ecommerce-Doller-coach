const mongoose = require("mongoose");
require("dotenv").config();

const Order = require("./models/order.model");

const TIMEOUT = 5000;

/**
 * CLI INPUT
 */
const args = process.argv.slice(2);

const getArg = (key) => {
    const arg = args.find(a => a.startsWith(`--${key}=`));
    return arg ? arg.split("=")[1] : null;
};

const orderId = getArg("id");
const userId = getArg("user");

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
 * MASK SENSITIVE DATA
 */
const maskOrder = (order) => {
    if (!order) return null;

    return {
        _id: order._id,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        itemsCount: order.products?.length || 0,
    };
};

async function checkOrder() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI not found");
        }

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            maxPoolSize: 5,
        });

        console.log("🔍 Running Order Diagnostic...");

        let query = {};

        if (orderId) {
            query._id = orderId;
        } else if (userId) {
            query.userId = userId;
        }

        /**
         * SAFE QUERY
         */
        const start = Date.now();

        const order = await withTimeout(
            Order.findOne(query)
                .sort({ createdAt: -1 })
                .select("total status paymentStatus createdAt products")
                .lean(),
            "Order Query"
        );

        const latency = Date.now() - start;

        if (!order) {
            console.log("⚠️ No order found");
            return;
        }

        /**
         * SAFE OUTPUT
         */
        const safeOrder = maskOrder(order);

        console.log("✅ Order Found:");
        console.log(JSON.stringify(safeOrder, null, 2));

        console.log(`⏱ Query latency: ${latency}ms`);

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(0);
    }
}

checkOrder();