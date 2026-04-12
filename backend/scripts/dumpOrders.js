const mongoose = require('mongoose');
require('dotenv').config();

const dump = async () => {
    try {
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri);
        const Order = require('../models/order.model');
        const orders = await Order.find().sort({ createdAt: -1 }).limit(5).lean();
        
        console.log(`Dumping last 5 orders:`);
        orders.forEach(o => {
            console.log(`ID: ${o._id} | Subtotal: ${o.subtotal} | GST: ${o.gst} | Total: ${o.total} | Status: ${o.status}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("ERROR:", err.message);
        process.exit(1);
    }
};

dump();
