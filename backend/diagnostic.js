const mongoose = require('mongoose');
require('dotenv').config();

const OrderSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Order = mongoose.model('DiagnosticOrder', OrderSchema, 'orders');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('--- DB CONNECTED ---');
    
    const count = await Order.countDocuments();
    console.log('Total Orders in DB:', count);
    
    const orders = await Order.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log('--- RECENT ORDERS ---');
    orders.forEach(o => {
      console.log(`ID: ${o._id}, Created: ${o.createdAt}, Type: ${typeof o.createdAt}, Total: ${o.total}, isPaid: ${o.isPaid}`);
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    console.log('Thirty Days Ago Threshold:', thirtyDaysAgo);

    const agg = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, volume: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('--- AGGREGATION RESULT (30 DAYS) ---');
    console.log(JSON.stringify(agg, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('DIAGNOSTIC FAILED:', err);
    process.exit(1);
  }
}

run();
