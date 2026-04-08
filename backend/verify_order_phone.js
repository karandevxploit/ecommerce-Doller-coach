const mongoose = require("mongoose");
const Order = require("./models/order.model");
const orderService = require("./services/order.service");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function verifyOrderPhone() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for verification\n");

  try {
    const testUserId = new mongoose.Types.ObjectId();
    const testOrderData = {
      products: [],
      subtotalAmount: 1000,
      discountAmount: 0,
      totalAmount: 1000,
      address: {
        name: "John Doe",
        phone: "9876543210",
        addressLine1: "Test Street 123",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001"
      },
      paymentMethod: "COD"
    };

    console.log("Creating test order using OrderService...");
    const order = await orderService.createOrder(testUserId, testOrderData);

    console.log("Order Created with ID:", order._id);
    console.log("Saved address String:", order.address);
    console.log("Saved shippingAddress Phone:", order.shippingAddress.phone);

    if (order.shippingAddress.phone === "9876543210") {
      console.log("✅ Passed: Phone number correctly saved in shippingAddress");
    } else {
      console.log("❌ Failed: Phone number not saved correctly");
    }

    // Cleanup
    await Order.deleteOne({ _id: order._id });
    console.log("\nCleanup completed.");

  } catch (error) {
    console.error("Verification error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

verifyOrderPhone();
