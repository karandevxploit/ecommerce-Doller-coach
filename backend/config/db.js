const mongoose = require("mongoose");
const { logger } = require("../utils/logger");
const env = require("./env");

// ---------- CONNECTION STATE GUARD ----------
let isConnected = false;

// ---------- GLOBAL EVENT LISTENERS ----------
mongoose.connection.on("error", (err) => {
  logger.error(`[MONGODB_DRIVER] ${err.message}`, { stack: err.stack });
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  logger.warn("[MONGODB_DISCONNECTED]");
});

mongoose.connection.on("reconnected", () => {
  isConnected = true;
  logger.info("[MONGODB_RECONNECTED]");
});

// ---------- MAIN CONNECT FUNCTION ----------
const connectDB = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000;

  if (isConnected) {
    logger.info("[MONGODB] Already connected. Skipping...");
    return;
  }

  if (!env.MONGO_URI) {
    throw new Error("❌ MONGO_URI missing");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`[MONGODB] Connecting... (${attempt}/${MAX_RETRIES})`);

      const conn = await mongoose.connect(env.MONGO_URI, {
        autoIndex: false, // ❗ production best practice
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: parseInt(process.env.DB_MAX_POOL) || 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        waitQueueTimeoutMS: 5000,
        retryWrites: true,
        family: 4,
        bufferCommands: false,
      });

      isConnected = true;
      logger.info("✅ MongoDB Connected");

      // Run migration safely (only one instance)
      if (process.env.INSTANCE_ID === "primary") {
        runStartupMigrations().catch(err => {
          logger.warn("Migration skipped", { error: err.message });
        });
      }

      return conn;

    } catch (error) {
      logger.error(`❌ DB Connection Failed (Attempt ${attempt})`, {
        message: error.message,
      });

      if (attempt === MAX_RETRIES) {
        logger.fatal("🚨 Max retries reached. Exiting process.");
        process.exit(1);
      }

      await new Promise(res => setTimeout(res, RETRY_DELAY));
    }
  }
};

// ---------- MIGRATION (BULK OPTIMIZED) ----------
async function runStartupMigrations() {
  const Order = require("../models/order.model");

  const count = await Order.countDocuments({ total: { $exists: false } });
  if (count === 0) return;

  logger.info(`[MIGRATION] Processing ${count} orders...`);

  const bulkOps = [];
  const cursor = Order.find({ total: { $exists: false } }).cursor();

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            total: doc.totalAmount || doc.totalPrice || 0
          }
        }
      }
    });

    if (bulkOps.length === 500) {
      await Order.bulkWrite(bulkOps);
      bulkOps.length = 0;
      await new Promise(res => setImmediate(res));
    }
  }

  if (bulkOps.length) {
    await Order.bulkWrite(bulkOps);
  }

  logger.info("✅ Migration complete");
}

// ---------- GLOBAL CRASH HANDLERS ----------
process.on("unhandledRejection", (err) => {
  logger.fatal("Unhandled Rejection", { error: err.message });
});

process.on("uncaughtException", (err) => {
  logger.fatal("Uncaught Exception", { error: err.message });
  process.exit(1);
});

module.exports = connectDB;