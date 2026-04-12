const { Worker } = require("bullmq");
const redis = require("./config/redis");
const logger = require("./utils/logger");
const connectDB = require("./config/db");
const os = require("os");

const RESOURCE_THRESHOLD = 0.90; // 90% RAM usage
let highLoadStrikes = 0;

const checkSystemHealth = () => {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usage = 1 - (freeMem / totalMem);
  
  if (usage > RESOURCE_THRESHOLD) {
    highLoadStrikes++;
    logger.warn(`[WORKER] Physical RAM saturation detected (${(usage * 100).toFixed(1)}%). Strike ${highLoadStrikes}/5.`);
    
    // FAIL-SAFE: If system is saturated for 5 consecutive checks, trigger graceful suicide
    if (highLoadStrikes >= 5) {
      logger.error("[CRITICAL] Sustained RAM saturation. Triggering graceful process suicide for clean restart.");
      process.exit(1); 
    }
    return false;
  }
  
  highLoadStrikes = 0; // Reset on healthy check
  return true;
};

// Import target services
const { sendEmailImmediate } = require("./utils/sendEmail");
const { notifyAdminsImmediate } = require("./services/notification.service");

/**
 * PRODUCTION WORKER PROCESS
 * Separated from main server to ensure high-performance API response.
 */
async function startWorkers() {
  logger.info("--- WORKER STARTUP ---");
  
  // 1. Connect Database (Required for most background tasks)
  try {
    await connectDB();
  } catch (err) {
    logger.error("Worker: Database Connection Failed", { error: err.message });
    process.exit(1);
  }

  // 2. Setup Email Worker
  const emailWorker = new Worker("email-queue", async (job) => {
    // Fail-Safe: Throttle if system is under pressure
    if (!checkSystemHealth()) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Sleep 5s
    }

    const { to, bcc, subject, html, attachments } = job.data;
    logger.info(`Processing Job: ${job.id} (Email to: ${to})`);
    
    try {
      await sendEmailImmediate({ to, bcc, subject, html, attachments });
    } catch (err) {
      logger.error(`Job Failed: ${job.id}`, { error: err.message });
      throw err; // Trigger BullMQ retry
    }
  }, { connection: redis });

  // 3. Setup Notification Worker
  const notificationWorker = new Worker("notification-queue", async (job) => {
    // Fail-Safe: Throttle if system is under pressure
    if (!checkSystemHealth()) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const { title, body, type } = job.data;
    logger.info(`Processing Job: ${job.id} (Notification: ${title})`);
    
    try {
      if (typeof notifyAdminsImmediate === 'function') {
        await notifyAdminsImmediate({ title, body, type });
      }
    } catch (err) {
      logger.error(`Notification Job Failed: ${job.id}`, { error: err.message });
      throw err;
    }
  }, { connection: redis });

  // Event Listeners
  emailWorker.on("completed", (job) => logger.info(`Job Finished: ${job.id}`));
  emailWorker.on("failed", (job, err) => logger.error(`Job CRITICAL Failure: ${job.id}`, { error: err.message }));

  logger.info("BullMQ Workers listening for incoming tasks...");
}

// Error handling for worker process
process.on("uncaughtException", (err) => {
  logger.error("WORKER CRASH: Uncaught Exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

startWorkers();
