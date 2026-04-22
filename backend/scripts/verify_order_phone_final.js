const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const Order = require("./models/order.model");
const orderService = require("./services/order.service");

const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force in production");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function isValidPincode(pin) {
  return /^\d{6}$/.test(pin);
}

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);

  let order = null;

  try {
    console.log("🚀 Running Shipping Address Validation...\n");

    const userId = new mongoose.Types.ObjectId();

    order = await orderService.createOrder(userId, {
      products: [{
        productId: new mongoose.Types.ObjectId(),
        quantity: 1,
        price: 1000
      }],
      subtotal: 1000,
      total: 1000,
      paymentMethod: "COD",
      shippingAddress: {
        name: "Alice Smith",
        phone: "7778889990",
        address: "Apartment 4B, Central Park",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001"
      }
    });

    const addr = order.shippingAddress;

    // 🔹 Structure validation
    const requiredKeys = ["name", "phone", "address", "city", "state", "pincode"];
    requiredKeys.forEach(k => {
      assert(addr[k] !== undefined, `${k} missing`);
      assert(addr[k] !== "", `${k} empty`);
    });

    // 🔹 Format validation
    assert(isValidPhone(addr.phone), "Invalid phone format");
    assert(isValidPincode(addr.pincode), "Invalid pincode");

    // 🔹 Normalization checks
    assert(addr.name === addr.name.trim(), "Name not trimmed");

    console.log("✅ Structure + format validation passed");

    // 🔹 Negative Test (invalid phone)
    let failed = false;
    try {
      await orderService.createOrder(userId, {
        products: [{
          productId: new mongoose.Types.ObjectId(),
          quantity: 1,
          price: 1000
        }],
        subtotal: 1000,
        total: 1000,
        paymentMethod: "COD",
        shippingAddress: {
          name: "Test",
          phone: "123", // invalid
          address: "Test",
          city: "Test",
          state: "Test",
          pincode: "123456"
        }
      });
    } catch {
      failed = true;
    }

    assert(failed, "Invalid phone should fail");

    console.log("✅ Negative test passed");

    console.log("\n🎉 ALL TESTS PASSED");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    if (order) await Order.deleteOne({ _id: order._id });
    await mongoose.connection.close();
  }
}

verify();