const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { buildPdfBuffer } = require("./services/invoice.service");
const Order = require("./models/order.model");
const User = require("./models/user.model");
const fs = require("fs");

dotenv.config();

const orderId = "69ca26e8d47f3e2fd753973b";

async function debug() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const order = await Order.findById(orderId).populate("products.productId").lean();
    if (!order) {
      console.log("Order not found");
      process.exit(1);
    }

    const customer = await User.findById(order.userId).lean();
    console.log("Generating PDF...");
    const buffer = await buildPdfBuffer(order, customer || { name: "Guest" });
    
    fs.writeFileSync("debug_generated.pdf", buffer);
    console.log("Success! PDF saved to debug_generated.pdf");
    process.exit(0);
  } catch (err) {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  }
}

debug();
