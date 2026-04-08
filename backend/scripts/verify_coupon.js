const mongoose = require("mongoose");
const Coupon = require("./models/coupon.model");
const Product = require("./models/product.model");
const orderService = require("./services/order.service");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function runVerification() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for verification\n");

  try {
    // 1. Setup Test Data
    const testCouponCode = "VERIFY_TEST_" + Date.now();
    const coupon = await Coupon.create({
      code: testCouponCode,
      discountType: "percentage",
      discountValue: 10,
      minOrderValue: 500,
      maxDiscount: 100, // Max discount of 100
      expiryDate: new Date(Date.now() + 86400000), // Tomorrow
      usageLimit: 5,
      isActive: true
    });

    const testProduct = await Product.create({
      title: "Test Product",
      category: "MEN",
      price: 1500,
      stock: 10,
      type: "TOPWEAR"
    });

    console.log(`Created Coupon: ${coupon.code} (10%, min 500, max 100)`);
    console.log(`Created Product: ${testProduct.title} (Price: 1500)\n`);

    // 2. Test Case: Success with Max Discount Cap
    console.log("--- Test Case 1: Success with Max Discount Cap ---");
    const cart1 = [{ productId: testProduct._id, quantity: 1 }];
    const result1 = await orderService.validateCartAndCalculateTotal(cart1, testCouponCode);
    console.log(`Subtotal: ${result1.subtotalAmount}, Discount: ${result1.discountAmount}, Total: ${result1.totalAmount}`);
    if (result1.discountAmount === 100) {
      console.log("✅ Passed: Discount capped at 100 (10% of 1500 is 150, but capped at 100)");
    } else {
      console.log("❌ Failed: Discount logic incorrect: " + result1.discountAmount);
    }

    // 3. Test Case: Minimum Order Value Not Met
    console.log("\n--- Test Case 2: Minimum Order Value Not Met ---");
    const cheapProduct = await Product.create({
        title: "Cheap Product",
        category: "MEN",
        price: 100,
        stock: 10,
        type: "TOPWEAR"
    });
    const cart2 = [{ productId: cheapProduct._id, quantity: 1 }];
    try {
      await orderService.validateCartAndCalculateTotal(cart2, testCouponCode);
      console.log("❌ Failed: Should have thrown error for min order value");
    } catch (err) {
      console.log(`✅ Passed: Threw expected error: "${err.message}"`);
    }

    // 4. Test Case: Expiry
    console.log("\n--- Test Case 3: Expiry ---");
    const expiredCouponCode = "EXPIRED_TEST_" + Date.now();
    await Coupon.create({
      code: expiredCouponCode,
      discountType: "fixed",
      discountValue: 50,
      minOrderValue: 0,
      expiryDate: new Date(Date.now() - 86400000), // Yesterday
      isActive: true
    });
    try {
      await orderService.validateCartAndCalculateTotal(cart1, expiredCouponCode);
      console.log("❌ Failed: Should have thrown error for expired coupon");
    } catch (err) {
      console.log(`✅ Passed: Threw expected error: "${err.message}"`);
    }

    // 5. Cleanup
    await Coupon.deleteOne({ code: testCouponCode });
    await Coupon.deleteOne({ code: expiredCouponCode });
    await Product.deleteOne({ _id: testProduct._id });
    await Product.deleteOne({ _id: cheapProduct._id });
    console.log("\nCleanup completed.");

  } catch (error) {
    console.error("Verification script error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

runVerification();
