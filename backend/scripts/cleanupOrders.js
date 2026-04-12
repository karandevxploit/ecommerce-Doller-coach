const mongoose = require('mongoose');
require('dotenv').config();

const cleanDB = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI not found");

        await mongoose.connect(uri);
        console.log("Connected to MongoDB for ledger cleanup...");

        const Order = require('../models/order.model');
        
        // Delete all orders to ensure a clean start with the new billing schema
        const result = await Order.deleteMany({});
        console.log(`CLEANUP COMPLETE: Purged ${result.deletedCount} legacy orders.`);

        process.exit(0);
    } catch (err) {
        console.error("CLEANUP ERROR:", err.message);
        process.exit(1);
    }
};

cleanDB();
