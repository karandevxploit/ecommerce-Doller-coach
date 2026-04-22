const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const TIMEOUT = 5000;

/**
 * Timeout wrapper
 */
const withTimeout = (promise, label) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout`)), TIMEOUT)
        ),
    ]);
};

async function checkDatabaseLimits() {
    let conn;

    try {
        conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            maxPoolSize: 5,
        });

        const db = mongoose.connection.db;

        console.log("🔍 MongoDB Diagnostics Started\n");

        /**
         * DB LEVEL STATS
         */
        const dbStats = await withTimeout(db.stats(), "DB Stats");

        console.log("📊 Database Stats:");
        console.log({
            db: dbStats.db,
            collections: dbStats.collections,
            dataSizeMB: (dbStats.dataSize / 1024 / 1024).toFixed(2),
            storageSizeMB: (dbStats.storageSize / 1024 / 1024).toFixed(2),
            indexes: dbStats.indexes,
        });

        /**
         * COLLECTIONS
         */
        const collections = await db.listCollections().toArray();

        console.log("\n📦 Collection Analysis:");

        for (const col of collections) {
            const collection = db.collection(col.name);

            const stats = await withTimeout(collection.stats(), "Collection Stats");

            const indexes = await collection.indexes();

            console.log(`\n🔹 ${col.name}`);
            console.log({
                documents: stats.count,
                sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                storageMB: (stats.storageSize / 1024 / 1024).toFixed(2),
                capped: stats.capped,
                indexes: indexes.length,
            });

            /**
             * INDEX WARNING
             */
            if (indexes.length <= 1) {
                console.warn(`⚠️  ${col.name} has very few indexes`);
            }
        }

        /**
         * SERVER INFO
         */
        const admin = db.admin();
        const serverStatus = await withTimeout(admin.serverStatus(), "Server Status");

        console.log("\n🧠 Server Insights:");
        console.log({
            connections: serverStatus.connections.current,
            memoryMB: (serverStatus.mem.resident),
            uptimeSec: serverStatus.uptime,
        });

        console.log("\n✅ MongoDB diagnostics completed");

        await mongoose.connection.close();
        process.exit(0);

    } catch (err) {
        console.error("❌ MongoDB diagnostics failed:", err.message);

        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }

        process.exit(1);
    }
}

checkDatabaseLimits();