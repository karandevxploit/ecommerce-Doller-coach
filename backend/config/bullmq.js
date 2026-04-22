const { Queue, Worker, QueueEvents } = require("bullmq");
const { redis: redisRaw } = require("./redis");
const { logger } = require("../utils/logger");

// QUEUE OPTIONS
const QUEUE_OPT = {
  connection: redisRaw,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
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
