const { Queue, Worker, QueueEvents } = require("bullmq");
const { redis: redisRaw } = require("./redis");
const { logger } = require("../utils/logger");

// QUEUE OPTIONS
const QUEUE_OPT = {
  connection: redisRaw,
  defaultJobOptions: {
    attempts: 5, // Increased for resilience on free-tier Redis
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 for debugging instead of instant deletion
      age: 3600,  // Or 1 hour
    },
    removeOnFail: true, // Auto-remove to save memory
  },
};

// INITIALIZE QUEUES
const orderQueue = new Queue("order-processing", QUEUE_OPT);
const emailQueue = new Queue("email-notifications", QUEUE_OPT);
const shiprocketQueue = new Queue("shiprocket-fulfillment", QUEUE_OPT);

logger.info("[BULLMQ] Queues initialized");

module.exports = {
  orderQueue,
  emailQueue,
  shiprocketQueue,
};
