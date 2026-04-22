const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const Order = require("./models/order.model");
const adminController = require("./controllers/admin.controller");

const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force to run in production");
  process.exit(1);
}

async function getRevenue() {
  return new Promise((resolve) => {
    adminController.stats({}, {
      json: (data) => resolve(data.totalRevenue || 0)
    });
  });
}

async function testRevenueImpact() {
  await mongoose.connect(process.env.MONGO_URI);

  let testOrder = null;

  try {
    console.log("🚀 Starting Revenue Impact Test...\n");

    const initialRevenue = await getRevenue();
    console.log(`Initial Revenue: ₹${initialRevenue}`);

    const subtotal = 500;
    const gst = Math.round(subtotal * 0.18);
    const delivery = 0;
    const total = subtotal + gst + delivery;

    testOrder = await Order.create({
      userId: new mongoose.Types.ObjectId(),
      products: [{
        productId: new mongoose.Types.ObjectId(),
        title: "Test Product",
        quantity: 1,
        price: subtotal
      }],
      subtotal,
      gst,
      delivery,
      total,
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      isPaid: false,
      shippingAddress: {
        fullName: "Test",
        phone: "9999999999"
      }
    });

    console.log(`Created order: ${testOrder._id}`);

    // Simulate payment success
    testOrder.paymentStatus = "PAID";
    testOrder.isPaid = true;
    testOrder.paidAt = new Date();

    await testOrder.save(); // 🔥 triggers hooks

    console.log("Marked order as PAID");

    // Wait for consistency (important if caching exists)
    await new Promise(res => setTimeout(res, 1000));

    const finalRevenue = await getRevenue();
    console.log(`Final Revenue: ₹${finalRevenue}`);

    const diff = finalRevenue - initialRevenue;

    console.log(`Difference: ₹${diff}`);

    if (Math.abs(diff - total) <= 1) {
      console.log("\n✅ PASS: Revenue updated correctly");
    } else {
      console.log(`\n❌ FAIL: Expected ₹${total}, got ₹${diff}`);
    }

  } catch (err) {
    console.error("❌ Test Failed:", err);
  } finally {
    if (testOrder) {
      await Order.deleteOne({ _id: testOrder._id });
      console.log("🧹 Cleanup done");
    }
    await mongoose.connection.close();
  }
}

testRevenueImpact();