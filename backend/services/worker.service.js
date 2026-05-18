const { Worker } = require("bullmq");
const Redis = require("ioredis");
const connectDB = require("../config/db");
const redisConfig = require("../config/redis");
const { logger } = require("../utils/logger");

// 1. Connection
const workersEnabled = process.env.ENABLE_QUEUE === "true" && redisConfig.isRealRedisReady?.();
const connection = workersEnabled
  ? new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { maxRetriesPerRequest: null })
  : null;

logger.info("🛠️ [WORKER_SERVICE] Background workers initializing...");

if (!workersEnabled) {
  logger.warn("[WORKER_SERVICE_DISABLED] Real Redis is not ready. Queue workers skipped; API will use local memory cache.");
  module.exports = { emailWorker: null, productEventsWorker: null };
  return;
}

const isDbReady = () => connectDB.isConnected();
const waitForDbReady = async (timeoutMs = 20000) => {
  if (isDbReady()) return true;
  await Promise.race([connectDB().catch(() => false), new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))]);

  return isDbReady();
};

// 2. Email Worker
const emailWorker = new Worker("email-queue", async (job) => {
  const dbReady = await waitForDbReady(15000);
  if (!dbReady) throw new Error("DB_NOT_READY_FOR_EMAIL_WORKER");

  const { sendEmailImmediate } = require("../utils/sendEmail");
  const Order = require("../models/order.model");
  const User = require("../models/user.model");

  logger.info(`[EMAIL_WORKER] Processing job: ${job.name} (ID: ${job.id})`);

  try {
    if (job.name === "send-email") {
      const { to, subject, html, bcc, attachments } = job.data;
      return await sendEmailImmediate({ to, subject, html, bcc, attachments });
    }

    if (job.name === "order-confirmation" || job.name === "order-status-update") {
      const { orderId, customerId } = job.data;
      const order = await Order.findById(orderId).lean();
      const customer = await User.findById(customerId || order?.userId).select("email name").lean();
      
      if (!order || !customer?.email) {
        logger.warn(`[EMAIL_JOB_SKIP] Incomplete data for ${job.name}: ${orderId}`);
        return;
      }

      return await sendEmailImmediate({
        to: customer.email,
        subject: job.name === "order-confirmation" ? `Order Confirmed #${order._id}` : `Order Status: ${order.status}`,
        html: `<p>Hello ${customer.name},</p><p>Your order <b>#${order._id}</b> is currently <b>${order.status}</b>.</p><p>Total: ₹${order.total}</p>`
      });
    }

    logger.warn(`[EMAIL_WORKER] Unknown job name: ${job.name}`);
  } catch (err) {
    logger.error(`[EMAIL_WORKER_ERROR] ${job.name} failed: ${err.message}`);
    throw err;
  }
}, { 
    connection,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
});

const productEventsWorker = new Worker(
  "product-events",
  async (job) => {
    if (job.name !== "send-product-emails") return;

    const dbReady = await waitForDbReady(15000);
    if (!dbReady) {
      throw new Error("DB_NOT_READY_FOR_PRODUCT_EVENTS");
    }

    const User = require("../models/user.model");
    const { sendEmailImmediate } = require("../utils/sendEmail");

    const { productId, productName, productPrice, productCategory } = job.data || {};
    const users = await User.find({ isDeleted: { $ne: true }, email: { $exists: true, $ne: "" } })
      .select("email name")
      .lean()
      .limit(5000);

    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map((user) =>
          sendEmailImmediate({
            to: user.email,
            subject: `New product: ${productName}`,
            html: `<p>Hi ${user.name || "Customer"}, a new product is live.</p>
                   <p><strong>${productName}</strong></p>
                   <p>Price: ${productPrice}</p>
                   <p>Category: ${productCategory || "N/A"}</p>
                   <p>Product ID: ${productId}</p>`,
          }).catch((err) => {
            logger.warn(`[PRODUCT_EVENT_EMAIL_FAIL] ${user.email}: ${err.message}`);
          })
        )
      );
    }
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: true,
    removeOnFail: true,
  }
);

// 3. Heavy Task Worker (Shiprocket)
const heavyWorker = new Worker("heavy-task-queue", async (job) => {
  const { orderId } = job.data;
  const dbReady = await waitForDbReady(15000);
  if (!dbReady) {
    throw new Error("DB_NOT_READY_FOR_HEAVY_WORKER");
  }
  
  if (job.name === "shiprocket-fulfillment") {
    logger.info(`[SHIPROCKET_JOB] Sending ${orderId} to Shiprocket... (Attempt: ${job.attemptsMade + 1})`);
    try {
      const shiprocketService = require("./shiprocket.service");
      const result = await shiprocketService.bookShipmentForOrder(orderId);
      
      // Realtime removed
      return result;
    } catch (err) {
      logger.error(`[SHIPROCKET_JOB_FAIL] ${orderId}: ${err.message}`);
      throw err;
    }
  }
  if (job.name === "shiprocket-booking") {
    const shiprocketService = require("./shiprocket.service");
    return shiprocketService.bookShipmentForOrder(orderId);
  }
  if (job.name === "shiprocket-booking-retry") {
    const shiprocketService = require("./shiprocket.service");
    return shiprocketService.bookShipmentForOrder(orderId);
  }
  if (job.name === "shiprocket-tracking-sync") {
    const shiprocketService = require("./shiprocket.service");
    return shiprocketService.syncTrackingStatus();
  }
}, { 
    connection,
    concurrency: 1, // Strict single-core limit for memory stability
    removeOnComplete: true, // Auto-remove to save Redis & worker memory
    removeOnFail: true,
});

// 4. Global Logging
[emailWorker, heavyWorker, productEventsWorker].forEach(worker => {
  worker.on("completed", (job) => logger.info(`[DONE] ${job.id} in ${worker.name}`));
  worker.on("failed", (job, err) => logger.error(`[FAIL] ${job.id} in ${worker.name}: ${err.message}`));
});

module.exports = { emailWorker, heavyWorker, productEventsWorker };
