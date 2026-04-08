const mongoose = require("mongoose");
const Order = require("./models/order.model");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

async function migrateAddressStructure() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for address structure migration\n");

  const orders = await Order.find({ 
    $or: [
      { "shippingAddress.phone": { $exists: false } },
      { "shippingAddress.phone": "N/A" },
      { "shippingAddress.phone": null },
      { "shippingAddress.phone": "" }
    ]
  });

  console.log(`Found ${orders.length} orders requiring structure migration.`);

  let updatedCount = 0;

  for (const order of orders) {
    let name = "";
    let phone = "";
    let address = "";
    let city = "";
    let state = "";
    let pincode = "";

    // Strategy 1: Split by "|"
    if (order.address && order.address.includes("|")) {
      const parts = order.address.split("|").map(s => s.trim());
      if (parts.length >= 3) {
        name = parts[0];
        phone = parts[1];
        address = parts[2];
        
        // Sub-split address for city, state, pincode if possible
        if (address.includes(",")) {
          const addrParts = address.split(",").map(s => s.trim());
          city = addrParts[1] || "";
          // state - pincode logic
          const lastPart = addrParts[addrParts.length - 1] || "";
          if (lastPart.includes("-")) {
            const statePincode = lastPart.split("-").map(s => s.trim());
            state = statePincode[0] || "";
            pincode = statePincode[1] || "";
          }
        }
      }
    } 
    // Strategy 2: Split by "," (Fallback)
    else if (order.address && order.address.includes(",")) {
      const parts = order.address.split(",").map(s => s.trim());
      // Common pattern: Name Phone, Address, City, State - Pincode
      name = parts[0]; 
      // Extract phone from name if merged
      const phoneMatch = name.match(/\d{10}/);
      if (phoneMatch) {
        phone = phoneMatch[0];
        name = name.replace(phone, "").replace("|", "").trim();
      }
      address = parts[1] || "";
      city = parts[2] || "";
      const lastPart = parts[parts.length - 1] || "";
      if (lastPart.includes("-")) {
        const statePincode = lastPart.split("-").map(s => s.trim());
        state = statePincode[0] || "";
        pincode = statePincode[1] || "";
      }
    }

    if (phone) {
      await Order.updateOne(
        { _id: order._id },
        { 
          $set: { 
            "shippingAddress.name": name || order.shippingAddress?.name || "",
            "shippingAddress.phone": phone,
            "shippingAddress.address": address || order.shippingAddress?.address || "",
            "shippingAddress.city": city || order.shippingAddress?.city || "",
            "shippingAddress.state": state || order.shippingAddress?.state || "",
            "shippingAddress.pincode": pincode || order.shippingAddress?.pincode || ""
          } 
        }
      );
      updatedCount++;
    }
  }

  console.log(`\nMigration complete. Updated ${updatedCount} records.`);
  await mongoose.connection.close();
}

migrateAddressStructure().catch(console.error);
