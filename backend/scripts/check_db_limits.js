const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

async function checkDatabaseLimits() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;
        const productsCollection = db.collection("products");
        const stats = await productsCollection.stats();
        
        console.log("--- MongoDB Products Collection Stats ---");
        console.log("Capped:", stats.capped);
        if (stats.capped) {
            console.log("Max Size (bytes):", stats.max);
            console.log("Max Documents:", stats.maxDocs);
        }
        console.log("Total Documents:", stats.count);
        console.log("Storage Size (MB):", (stats.storageSize / 1024 / 1024).toFixed(2));
        console.log("-----------------------------------------");
        
        process.exit(0);
    } catch (err) {
        console.error("Error checking database limits:", err);
        process.exit(1);
    }
}

checkDatabaseLimits();
