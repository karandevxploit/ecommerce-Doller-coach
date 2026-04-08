const mongoose = require("mongoose");
const Order = require("./models/order.model");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function migrateOrders() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for migration\n");

  try {
    // Find orders with missing shippingAddress.phone or missing structured data
    const orders = await Order.find({
      $or: [
        { "shippingAddress.phone": { $exists: false } },
        { "shippingAddress.phone": "" },
        { "shippingAddress.address": { $exists: false } }
      ]
    });

    console.log(`Found ${orders.length} orders requiring migration.`);

    let updatedCount = 0;

    for (const order of orders) {
      const addressStr = order.address || "";
      
      // Attempt to extract 10-digit phone number
      const phoneMatch = addressStr.match(/(\+91)?\d{10}/);
      const extractedPhone = phoneMatch ? phoneMatch[0] : "";

      // Attempt to extract city/state/pincode if possible (very basic)
      // Name, House, Street, City, State - Pincode
      const parts = addressStr.split(",").map(s => s.trim());
      
      const newShippingAddress = {
        name: order.shippingAddress?.name || (parts[0] || "Customer"),
        phone: order.shippingAddress?.phone || extractedPhone || "",
        address: order.shippingAddress?.address || addressStr,
        city: order.shippingAddress?.city || "",
        state: order.shippingAddress?.state || "",
        pincode: order.shippingAddress?.pincode || ""
      };

      // Only update if we actually found something to fill
      if (!order.shippingAddress?.phone || !order.shippingAddress?.address) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { shippingAddress: newShippingAddress } }
        );
        updatedCount++;
      }
    }

    console.log(`Successfully migrated ${updatedCount} orders.`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

migrateOrders();
