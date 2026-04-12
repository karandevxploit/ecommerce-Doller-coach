const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const rawFix = async () => {
    try {
        const uri = process.env.MONGO_URI;
        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db();
        const collection = db.collection('orders');

        console.log("Starting RAW MongoDB Reconciliation...");

        const orders = await collection.find({ subtotal: { $gt: 0 } }).toArray();
        console.log(`Analyzing ${orders.length} orders directly...`);

        let updatedCount = 0;
        for (const order of orders) {
            const subtotal = order.subtotal || 0;
            const discount = order.discount || 0;
            const expectedGst = Math.round(subtotal * 0.18);
            const expectedTotal = subtotal - discount + expectedGst;

            // If any of the new naming is missing or incorrect, fix it
            if (order.gst !== expectedGst || order.total !== expectedTotal || order.delivery !== 0) {
                console.log(`Fixing #${String(order._id).slice(-6).toUpperCase()} | Sub: ${subtotal} | OldGst: ${order.gst} -> New: ${expectedGst}`);
                
                await collection.updateOne(
                    { _id: order._id },
                    { 
                        $set: { 
                            gst: expectedGst, 
                            total: expectedTotal, 
                            delivery: 0,
                            subtotal: subtotal, // Ensure subtotal is set too
                            discount: discount 
                        },
                        $unset: { 
                            gstAmount: "", 
                            totalAmount: "", 
                            subtotalAmount: "", 
                            deliveryFee: "" 
                        }
                    }
                );
                updatedCount++;
            }
        }

        console.log(`Successfully reconciled ${updatedCount} orders RAW.`);
        await client.close();
        process.exit(0);
    } catch (err) {
        console.error("FATAL ERROR:", err.message);
        process.exit(1);
    }
};

rawFix();
