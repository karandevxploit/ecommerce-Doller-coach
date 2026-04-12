const mongoose = require('mongoose');
require('dotenv').config();

const reconcile = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI not found");

        await mongoose.connect(uri);
        const Order = require('../models/order.model');
        
        console.log("Starting GST Reconciliation...");

        // 1. Find ANY order where subtotal exists (regardless of type)
        const allOrders = await Order.find({ subtotal: { $exists: true } }).lean();
        console.log(`Analyzing ${allOrders.length} orders total...`);

        let updatedCount = 0;
        for (const order of allOrders) {
            const subtotal = Number(order.subtotal || 0);
            const discount = Number(order.discount || 0);
            const expectedGst = Math.round(subtotal * 0.18);
            const expectedTotal = subtotal - discount + expectedGst;

            // Check if reconciliation is needed
            if (order.gst !== expectedGst || order.total !== expectedTotal || order.delivery !== 0) {
                console.log(`Fixing #${String(order._id).slice(-6).toUpperCase()} | Sub: ${subtotal} | OldGst: ${order.gst} -> New: ${expectedGst}`);
                
                await Order.collection.updateOne(
                    { _id: order._id },
                    { 
                        $set: { 
                            gst: expectedGst, 
                            total: expectedTotal, 
                            delivery: 0,
                            subtotal: subtotal,
                            discount: discount 
                        }
                    }
                );
                updatedCount++;
            }
        }

        console.log(`Successfully reconciled ${updatedCount} orders.`);
        process.exit(0);
    } catch (err) {
        console.error("CRITICAL RECONCILIATION ERROR:", err.message);
        process.exit(1);
    }
};

reconcile();
