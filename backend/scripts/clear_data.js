require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

const clearData = async () => {
    try {
        console.log("🚀 Starting Database Clearance...");
        
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            console.error("❌ MONGO_URI missing in .env");
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB");

        const collections = ["products", "orders", "reviews", "carts", "coupons", "notifications", "addresses", "wishlists", "refresh_tokens"];

        for (const colName of collections) {
            try {
                const collection = mongoose.connection.collection(colName);
                const count = await collection.countDocuments();
                if (count > 0) {
                    await collection.deleteMany({});
                    console.log(`🗑️  Cleared ${count} documents from [${colName}]`);
                } else {
                    console.log(`ℹ️  Collection [${colName}] is already empty`);
                }
            } catch (err) {
                console.log(`⚠️  Skip [${colName}]: ${err.message}`);
            }
        }

        console.log("\n✨ DATABASE CLEANUP COMPLETE");
        console.log("Note: Users were NOT deleted to preserve admin access.");
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error("💥 CRITICAL ERROR:", err.message);
        process.exit(1);
    }
};

clearData();
