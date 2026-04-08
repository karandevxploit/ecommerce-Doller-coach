const mongoose = require("mongoose");
const Order = require("./models/order.model");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function migrateOrdersSplit() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for split migration\n");

  try {
    // Find orders with address string containing the '|' separator
    const orders = await Order.find({
      address: { $regex: /\|/ }
    });

    console.log(`Found ${orders.length} orders matching legacy string pattern (with '|')`);

    let updatedCount = 0;

    for (const order of orders) {
      if (!order.address) continue;

      const parts = order.address.split("|").map(s => s.trim());
      
      // Expected: Name | Phone | Address (3 parts)
      if (parts.length >= 2) {
        const name = parts[0] || "";
        const phone = parts[1] || "";
        const address = parts[2] || parts.slice(2).join(", ") || "";

        const newShippingAddress = {
          name: order.shippingAddress?.name || name,
          phone: order.shippingAddress?.phone || phone,
          address: order.shippingAddress?.address || address,
          city: order.shippingAddress?.city || "",
          state: order.shippingAddress?.state || "",
          pincode: order.shippingAddress?.pincode || ""
        };

        // Update document with structured data
        await Order.updateOne(
          { _id: order._id },
          { 
            $set: { shippingAddress: newShippingAddress },
            // We can unset the legacy address string or keep it
            // User requested to "Replace address: String with shippingAddress: Object"
          }
        );
        updatedCount++;
        console.log(`Migrated: ${order._id} - Extracted Phone: ${phone}`);
      }
    }

    console.log(`\nSuccessfully migrated ${updatedCount} orders using the '|' split method.`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

migrateOrdersSplit();
