const { Queue } = require("bullmq");
const { rawClient: redis, isRedisReady } = require("../config/redis");
const { logger } = require("../utils/logger");
const AppError = require("../utils/AppError");
const env = require("../config/env");

/**
 * PRODUCTION-GRADE SMART TASK QUEUE
 * Implements a "Smart Hybrid" failure strategy:
 * - If Redis is UP: High-performance background processing via BullMQ.
 * - If Redis is DOWN:
 *    - Critical Jobs: Fail fast with 503.
 *    - Non-Critical Jobs: Log and bypass to save user transaction.
 */
class TaskQueue {
  constructor(name, critical = false) {
    this.name = name;
    this.isCritical = critical;
    this.queue = null;
    this.isDisabled = !env.REDIS_ENABLED;
  }

  /**
   * Physically attaches the queue to the Redis cluster.
   */
  initialize() {
    if (this.queue || this.isDisabled) return;
    
    // Safety check for raw redis client
    if (!redis || redis.constructor.name === 'Proxy') {
        if (!isRedisReady()) {
            logger.warn(`[BULLMQ_DEFERRED] Queue "${this.name}" waiting for Redis synchronization...`);
            return;
        }
    }

    try {
        const Redis = require("ioredis");
        this.queue = new Queue(this.name, {
            connection: new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: null,
            }),
            defaultJobOptions: {
                attempts: 5,
                backoff: { type: "exponential", delay: 2000 },
                removeOnComplete: true, // Fallback for limited Redis CONFIG SET permissions
                removeOnFail: true,     // Fallback for limited Redis CONFIG SET permissions
            },
        });
        
        this.queue.on("error", (err) => {
            logger.error(`[BULLMQ_QUEUE_ERROR] "${this.name}": ${err.message}`);
        });

        logger.info(`[BULLMQ] Queue "${this.name}" attached successfully.`);
    } catch (err) {
        logger.error(`[BULLMQ_ATTACH_FAILURE] "${this.name}": ${err.message}`);
        this.isDisabled = true; // Permanent disable for this instance if attachment fails
    }
  }

  async add(jobName, data) {
    if (this.isDisabled || !isRedisReady()) {
      if (this.isCritical) {
        logger.error(`[QUEUES_CRITICAL_FAILURE] Denied task "${jobName}" in "${this.name}" (Redis Offline).`);
        throw new AppError("System busy. Please try again later.", 503);
      } else {
        logger.warn(`[QUEUES_BYPASS] Degraded mode active for "${jobName}" in "${this.name}".`);
        return { id: "deferred", status: "degraded" }; 
      }
    }

    if (!this.queue) this.initialize();
    if (!this.queue) return null;

    try {
      return await this.queue.add(jobName, data);
    } catch (error) {
      logger.error(`[BULLMQ_RUNTIME_EXCEPTION] Task submission failed for "${this.name}": ${error.message}`);
      if (this.isCritical) throw error;
      return null;
    }
  }
}

// Dedicated Queues
const emailQueue = new TaskQueue("email-queue", false);
const notificationQueue = new TaskQueue("notification-queue", false);
const heavyTaskQueue = new TaskQueue("heavy-task-queue", true);

const initializeAllQueues = async () => {
    if (!env.REDIS_ENABLED) {
        logger.info("[QUEUES_DISABLED] Architect kill-switch active. Skipping message broker synchronization.");
        return;
    }
    logger.info("[BULLMQ] Synchronizing queue manifests...");
    emailQueue.initialize();
    notificationQueue.initialize();
    heavyTaskQueue.initialize();
};

module.exports = { emailQueue, notificationQueue, heavyTaskQueue, TaskQueue, initializeAllQueues };
