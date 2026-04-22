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

async function verifyOrderPhone() {
  await mongoose.connect(process.env.MONGO_URI);

  let order;

  try {
    console.log("🚀 Verifying shippingAddress phone logic...\n");

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
        name: "John Doe",
        phone: "9876543210",
        address: "Test Street 123",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001"
      }
    });

    const phone = order.shippingAddress?.phone;

    // ✅ Existence check
    assert(phone !== undefined, "Phone missing");

    // ✅ Value check
    assert(phone === "9876543210", "Phone value incorrect");

    // ✅ Format check
    assert(/^[6-9]\d{9}$/.test(phone), "Phone format invalid");

    console.log("✅ Phone correctly stored in shippingAddress");

    // 🔥 Migration validation
    assert(!order.address, "Legacy address field still exists");

    console.log("✅ Legacy address field removed");

    // ❌ Negative test
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

    console.log("✅ Negative validation passed");

    console.log("\n🎉 ALL TESTS PASSED");

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    if (order) await Order.deleteOne({ _id: order._id });
    await mongoose.connection.close();
  }
}

verifyOrderPhone();