const mongoose = require('mongoose');
require('dotenv').config();

const checkOrder = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI not found");

        await mongoose.connect(uri);
        const Order = require('./models/order.model');
        
        const lastOrder = await Order.findOne().sort({ createdAt: -1 }).lean();
        console.log("LAST ORDER IN DB:", JSON.stringify(lastOrder, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("ERROR:", err.message);
        process.exit(1);
    }
};

checkOrder();
