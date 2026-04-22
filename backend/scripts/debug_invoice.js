const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

const { buildPdfBuffer } = require("./services/invoice.service");
const Order = require("./models/order.model");
const User = require("./models/user.model");

dotenv.config();

/**
 * CLI ARG PARSER
 */
const args = process.argv.slice(2);

const getArg = (key) => {
  const arg = args.find(a => a.startsWith(`--${key}=`));
  return arg ? arg.split("=")[1] : null;
};

const orderId = getArg("orderId");
const outputFile = getArg("output") || "invoice_debug.pdf";

if (!orderId) {
  console.error("❌ Usage: node debugInvoice.js --orderId=ID [--output=file.pdf]");
  process.exit(1);
}

/**
 * TIMEOUT WRAPPER
 */
const withTimeout = (promise, label, ms = 8000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms)
    ),
  ]);
};

/**
 * VALIDATE OBJECT ID
 */
const isValidObjectId = mongoose.Types.ObjectId.isValid(orderId);
if (!isValidObjectId) {
  console.error("❌ Invalid Order ID");
  process.exit(1);
}

async function debug() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      maxPoolSize: 5,
    });

    console.log("🔌 Connected to DB");

    const start = Date.now();

    /**
     * SAFE QUERY (LIMITED FIELDS)
     */
    const order = await withTimeout(
      Order.findById(orderId)
        .select("products total createdAt userId paymentStatus status")
        .populate("products.productId", "title price")
        .lean(),
      "Order Query"
    );

    if (!order) {
      console.error("⚠️ Order not found");
      return;
    }

    const customer = await withTimeout(
      User.findById(order.userId)
        .select("name email")
        .lean(),
      "User Query"
    );

    console.log("🧾 Generating PDF...");

    const buffer = await withTimeout(
      buildPdfBuffer(order, customer || { name: "Guest" }),
      "PDF Generation",
      10000
    );

    /**
     * FILE SAFETY
     */
    const outputPath = path.resolve(process.cwd(), outputFile);

    if (fs.existsSync(outputPath)) {
      console.warn("⚠️ File exists. Overwriting...");
    }

    fs.writeFileSync(outputPath, buffer);

    const latency = Date.now() - start;

    console.log("✅ PDF generated successfully");
    console.log({
      file: outputPath,
      sizeKB: (buffer.length / 1024).toFixed(2),
      durationMs: latency,
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

debug();