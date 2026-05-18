const OutboxEvent = require("../models/outboxEvent.model");
const connectDB = require("../config/db");
const env = require("../config/env");
const { logger } = require("../utils/logger");
const { emailQueue, notificationQueue, heavyTaskQueue } = require("./queue.service");

const backoffSeconds = (attempt) => Math.min(2 ** attempt * 5, 1800);
const DEFAULT_POLL_INTERVAL_MS = 10000;
const ACTIVE_BATCH_INTERVAL_MS = 1500;
const DB_RETRY_INTERVAL_MS = 10000;
const EMPTY_QUEUE_INTERVAL_MS = 10000;

const publishEvent = async (event, session = null) => {
  const doc = {
    aggregateType: event.aggregateType,
    aggregateId: String(event.aggregateId),
    eventType: event.eventType,
    payload: event.payload || {},
    status: "pending",
    attempts: 0,
    nextRetryAt: new Date(),
  };
  return OutboxEvent.create([doc], session ? { session } : undefined);
};

const processSingleEvent = async (event) => {
  try {
    await OutboxEvent.updateOne(
      { _id: event._id, status: { $in: ["pending", "failed"] } },
      { $set: { status: "processing" } }
    );

    switch (event.eventType) {
      case "ORDER_CREATED":
        await Promise.allSettled([
          emailQueue.add("order-placed", event.payload),
          notificationQueue.add("order-created-notify", event.payload),
        ]);
        break;
      case "PAYMENT_VERIFIED":
        await Promise.allSettled([
          heavyTaskQueue.add("shiprocket-fulfillment", event.payload),
          emailQueue.add("payment-verified", event.payload),
        ]);
        break;
      default:
        logger.warn({ eventType: event.eventType, outboxId: event._id }, "UNKNOWN_OUTBOX_EVENT");
    }

    await OutboxEvent.updateOne(
      { _id: event._id },
      { $set: { status: "processed", processedAt: new Date(), lastError: "" } }
    );
  } catch (err) {
    const attempts = (event.attempts || 0) + 1;
    const dead = attempts >= (event.maxAttempts || 8);
    const nextRetryAt = new Date(Date.now() + backoffSeconds(attempts) * 1000);

    await OutboxEvent.updateOne(
      { _id: event._id },
      {
        $set: {
          status: dead ? "dead_letter" : "failed",
          lastError: err.message || "Outbox processing failed",
          nextRetryAt,
        },
        $inc: { attempts: 1 },
      }
    );
    if (dead) {
      logger.error({
        outboxId: String(event._id),
        eventType: event.eventType,
        attempts,
        error: err.message,
      }, "ALERT_OUTBOX_DEAD_LETTER");
    }
  }
};

const processBatch = async (batchSize = 25) => {
  const now = new Date();
  const events = await OutboxEvent.find({
    status: { $in: ["pending", "failed"] },
    nextRetryAt: { $lte: now },
  })
    .sort({ createdAt: 1 })
    .limit(batchSize)
    .lean();

  await Promise.allSettled(events.map((event) => processSingleEvent(event)));
  return events.length;
};

let workerStarted = false;
let workerTimer = null;
let isProcessing = false;
let workerIntervalCount = 0;
let workerExecutionCount = 0;
const workerStartTime = new Date();

const isDbReady = () => connectDB.isConnected();

const processOutbox = async () => {
  if (isProcessing || !workerStarted) return;
  if (!isDbReady()) {
    logger.warn("OUTBOX_WORKER_SKIPPED_DB_NOT_READY");
    return;
  }

  isProcessing = true;
  try {
    const events = await OutboxEvent.find({
      status: { $in: ["pending", "failed"] },
      nextRetryAt: { $lte: new Date() },
    })
      .sort({ createdAt: 1 })
      .limit(OUTBOX_BATCH_SIZE)
      .lean();

    if (!events.length) {
      return;
    }

    logger.info({ count: events.length }, "OUTBOX_BATCH_START");
    for (const event of events) {
      await processSingleEvent(event);
    }
    logger.info({ count: events.length }, "OUTBOX_BATCH_COMPLETE");
  } catch (err) {
    logger.error({ error: err.message }, "OUTBOX_ERROR");
  } finally {
    isProcessing = false;
  }
};

let isRunning = false;

const startOutboxWorker = () => {
  if (workerStarted) {
    return;
  }
  
  // Only run if explicitly enabled via ENABLE_OUTBOX=true
  if (process.env.ENABLE_OUTBOX !== "true") {
    return;
  }

  workerStarted = true;
  
  // Step 3: Concurrency Guard + 30 sec interval
  workerTimer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
       await processOutbox();
    } catch (e) {
       console.error("Worker error:", e.message);
    }

    isRunning = false;
  }, 30000); 
  
  workerTimer.unref();
  
  logger.info("OUTBOX_WORKER_STARTED", { intervalMs: 30000 });
};

const stopOutboxWorker = () => {
  if (!workerStarted) return;
  workerStarted = false;
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  logger.warn("OUTBOX_WORKER_STOPPED");
};

const getWorkerStats = () => ({
  started: workerStarted,
  intervalCount: workerIntervalCount,
  executionCount: workerExecutionCount,
  uptime: Date.now() - workerStartTime.getTime(),
  isProcessing,
});

module.exports = {
  publishEvent,
  processBatch,
  startOutboxWorker,
  stopOutboxWorker,
  getWorkerStats,
};
