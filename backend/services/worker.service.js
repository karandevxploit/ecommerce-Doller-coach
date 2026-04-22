const { Worker } = require("bullmq");
const Redis = require("ioredis");
const { logger } = require("../utils/logger");

// 1. Connection
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

logger.info("🛠️ [WORKER_SERVICE] Background workers initializing...");

// 2. Email Worker
const emailWorker = new Worker("email-queue", async (job) => {
  const { orderId, customerId } = job.data;
  logger.info(`[EMAIL_JOB] Processing order confirmation for ${orderId} (Attempt: ${job.attemptsMade + 1})`);
  
  try {
    const Order = require("../models/order.model");
    const User = require("../models/user.model");
    const emailService = require("./email.service");
    
    // Optimized fetch with projections
    const order = await Order.findById(orderId).select("total status invoiceNumber").lean();
    const customer = await User.findById(customerId).select("email name").lean();
    
    if (!order || !customer) {
        logger.warn(`[EMAIL_JOB_SKIP] Data missing for order ${orderId}`);
        return;
    }

    if (emailService.sendOrderPlacedEmails) {
      await emailService.sendOrderPlacedEmails({ order, customer });
    }
  } catch (err) {
    logger.error(`[EMAIL_JOB_FAIL] ${orderId}: ${err.message}`);
    throw err; // BullMQ handles exponential backoff retry
  }
}, { 
    connection,
    settings: {
        backoffStrategies: {
            exponential: (delay) => (attemptsMade) => Math.pow(2, attemptsMade) * delay
        }
    }
});

// 3. Heavy Task Worker (Shiprocket)
const heavyWorker = new Worker("heavy-task-queue", async (job) => {
  const { orderId } = job.data;
  
  if (job.name === "shiprocket-fulfillment") {
    logger.info(`[SHIPROCKET_JOB] Sending ${orderId} to Shiprocket... (Attempt: ${job.attemptsMade + 1})`);
    try {
      const shiprocketService = require("./shiprocket.service");
      const result = await shiprocketService.processOrder(orderId);
      
      // Update realtime dashboard if needed
      const realtimeService = require("./realtime.service");
      realtimeService.broadcast("order:fulfillment_init", { orderId, status: "SYNCED" });

      return result;
    } catch (err) {
      logger.error(`[SHIPROCKET_JOB_FAIL] ${orderId}: ${err.message}`);
      throw err;
    }
  }
}, { connection });

// 4. Global Logging
[emailWorker, heavyWorker].forEach(worker => {
  worker.on("completed", (job) => logger.info(`[DONE] ${job.id} in ${worker.name}`));
  worker.on("failed", (job, err) => logger.error(`[FAIL] ${job.id} in ${worker.name}: ${err.message}`));
});

module.exports = { emailWorker, heavyWorker };
