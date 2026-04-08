const mongoose = require("mongoose");
const Order = require("./models/order.model");
const orderService = require("./services/order.service");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function verifyOrderPhoneFinal() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for final verification\n");

  try {
    const testUserId = new mongoose.Types.ObjectId();
    const testOrderData = {
      products: [],
      subtotalAmount: 1000,
      discountAmount: 0,
      totalAmount: 1000,
      address: {
        name: "Alice Smith",
        phone: "7778889990",
        address: "Apartment 4B, Central Park",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001"
      },
      paymentMethod: "COD"
    };

    console.log("Creating test order using standard OrderService...");
    const order = await orderService.createOrder(testUserId, testOrderData);

    console.log("Order Created with ID:", order._id);
    console.log("Database shippingAddress Object:", JSON.stringify(order.shippingAddress, null, 2));

    const expectedKeys = ["name", "phone", "address", "city", "state", "pincode"];
    const savedKeys = Object.keys(order.shippingAddress.toObject());
    
    let allKeysPresent = true;
    expectedKeys.forEach(key => {
      if (!savedKeys.includes(key) || !order.shippingAddress[key]) {
        console.log(`❌ Missing or empty key: ${key}`);
        allKeysPresent = false;
      } else {
        console.log(`✅ Key present and valid: ${key} (${order.shippingAddress[key]})`);
      }
    });

    if (allKeysPresent) {
      console.log("\n✅ ALL CRITICAL KEYS PRESENT AND VALIDATED IN DATABASE");
    } else {
      console.log("\n❌ DATA INTEGRITY FAILURE: Some keys are missing or empty.");
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

verifyOrderPhoneFinal();
