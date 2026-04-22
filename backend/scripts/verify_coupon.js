const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const Coupon = require("./models/coupon.model");
const Product = require("./models/product.model");
const orderService = require("./services/order.service");

const FORCE = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !FORCE) {
  console.error("❌ BLOCKED: Use --force in production");
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error("ASSERT FAIL: " + message);
  }
}

async function runVerification() {
  await mongoose.connect(process.env.MONGO_URI);

  let testProduct, cheapProduct, coupon, expiredCoupon;

  try {
    console.log("🚀 Running coupon validation tests...\n");

    const code = "VERIFY_" + Date.now();

    coupon = await Coupon.create({
      code,
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 500,
      maxDiscount: 100,
      endDate: new Date(Date.now() + 86400000),
      usageLimit: 5,
      isActive: true
    });

    testProduct = await Product.create({
      title: "Test Product",
      category: "men",
      price: 1500,
      stock: 10,
      status: "active",
      images: ["https://cdn.test.com/test.jpg"]
    });

    // ✅ TEST 1: Max Discount Cap
    const res1 = await orderService.validateCartAndCalculateTotal(
      [{ productId: testProduct._id, quantity: 1 }],
      code
    );

    assert(res1.discountAmount === 100, "Discount cap failed");

    console.log("✅ Test 1 passed");

    // ✅ TEST 2: Min Order Fail
    cheapProduct = await Product.create({
      title: "Cheap",
      category: "men",
      price: 100,
      stock: 10,
      status: "active",
      images: ["https://cdn.test.com/test.jpg"]
    });

    let failed = false;
    try {
      await orderService.validateCartAndCalculateTotal(
        [{ productId: cheapProduct._id, quantity: 1 }],
        code
      );
    } catch {
      failed = true;
    }

    assert(failed, "Min order validation failed");

    console.log("✅ Test 2 passed");

    // ✅ TEST 3: Expiry
    expiredCoupon = await Coupon.create({
      code: "EXP_" + Date.now(),
      discountType: "fixed",
      discountValue: 50,
      minOrderAmount: 0,
      endDate: new Date(Date.now() - 1000),
      isActive: true
    });

    failed = false;
    try {
      await orderService.validateCartAndCalculateTotal(
        [{ productId: testProduct._id, quantity: 1 }],
        expiredCoupon.code
      );
    } catch {
      failed = true;
    }

    assert(failed, "Expiry validation failed");

    console.log("✅ Test 3 passed");

    console.log("\n🎉 ALL TESTS PASSED");

  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    await Coupon.deleteMany({ code: { $regex: "VERIFY_|EXP_" } });
    if (testProduct) await Product.deleteOne({ _id: testProduct._id });
    if (cheapProduct) await Product.deleteOne({ _id: cheapProduct._id });

    await mongoose.connection.close();
  }
}

runVerification();