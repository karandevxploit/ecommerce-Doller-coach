const mongoose = require("mongoose");
const Order = require("./models/order.model");
const adminController = require("./controllers/admin.controller");
const orderController = require("./controllers/order.controller");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function testRevenueImpact() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for revenue impact test\n");

  try {
    // 1. Get Initial Revenue
    const req = {};
    const res = { json: (data) => data };
    const initialStats = await new Promise((resolve) => {
      adminController.stats(req, { json: resolve });
    });
    const initialRevenue = initialStats.totalRevenue;
    console.log(`Initial Total Revenue: ₹${initialRevenue}`);

    // 2. Create a test PAID order
    const testAmount = 500;
    const testOrder = await Order.create({
      userId: new mongoose.Types.ObjectId(),
      products: [{ productId: new mongoose.Types.ObjectId(), title: "Test Product", quantity: 1, price: testAmount }],
      totalAmount: testAmount,
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      isPaid: false,
      address: "Test Address",
      shippingAddress: { name: "Test", phone: "1234567890", address: "Test", city: "Test", state: "Test", pincode: "123456" }
    });
    console.log(`Created PENDING test order with ID: ${testOrder._id} for ₹${testAmount}`);

    // 3. Mark as PAID via the new logic
    await Order.findByIdAndUpdate(testOrder._id, {
      isPaid: true,
      paymentStatus: "PAID",
      paidAt: new Date()
    });
    console.log("Marked test order as PAID.");

    // 4. Verify Final Revenue
    const finalStats = await new Promise((resolve) => {
      adminController.stats(req, { json: resolve });
    });
    const finalRevenue = finalStats.totalRevenue;
    console.log(`Final Total Revenue: ₹${finalRevenue}`);

    const difference = finalRevenue - initialRevenue;
    console.log(`Revenue Difference: ₹${difference}`);

    if (difference === testAmount) {
      console.log("\n✅ SUCCESS: Revenue updated immediately and accurately.");
    } else {
      console.log("\n❌ FAILURE: Revenue mismatch. Expected ₹" + testAmount + " increase.");
    }

    // Cleanup
    await Order.deleteOne({ _id: testOrder._id });
    console.log("\nCleanup completed.");

  } catch (error) {
    console.error("Test Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

testRevenueImpact();
