const mongoose = require("mongoose");
const { logger } = require("../utils/logger");
const env = require("./env");

// ---------- CONNECTION STATE GUARD ----------
let isConnected = false;

// PERFORMANCE CONFIG
const SLOW_QUERY_THRESHOLD_MS = 500; // Log queries taking longer than 500ms

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

// ---------- SLOW QUERY LOGGER & PERFORMANCE ----------
// Set Global Default for maxTimeMS to prevent runaway queries blocking the event loop
mongoose.set('maxTimeMS', 10000); // 10s max for any query

if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', true);
} else {
    // Production: Selective debug/logging for slow queries disabled for cleaner logs
    mongoose.set('debug', false);
}

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
        maxPoolSize: parseInt(process.env.DB_MAX_POOL) || 20, // Optimized for stability
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        waitQueueTimeoutMS: 10000,
        retryWrites: true,
        family: 4,
        bufferCommands: false,
      });

      isConnected = true;
      logger.info("✅ MongoDB Connected [POOL: 20]");

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

module.exports = connectDB;