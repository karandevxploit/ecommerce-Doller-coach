const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { Queue, QueueEvents } = require("bullmq");
const { rawClient: redis } = require("../config/redis");
const { logger } = require("../utils/logger");

const QUEUE_NAME = "email-queue-test"; // isolated test queue

async function runTest() {
    logger.info("🧪 Starting BullMQ Lifecycle Test (SAFE MODE)...");

    const queue = new Queue(QUEUE_NAME, { connection: redis });
    const events = new QueueEvents(QUEUE_NAME, { connection: redis });

    try {
        /**
         * 1. Ensure Redis Ready
         */
        if (redis.status !== "ready") {
            logger.warn("Waiting for Redis...");
            await new Promise((res) => redis.once("ready", res));
        }

        logger.info("✅ Redis Connected");

        /**
         * 2. CLEAN QUEUE SAFELY
         */
        await queue.drain();
        await queue.clean(0, 100, "completed");
        await queue.clean(0, 100, "failed");

        logger.info("🧹 Queue cleaned safely");

        /**
         * 3. ADD JOB (IDEMPOTENT)
         */
        const jobId = `test-${Date.now()}`;

        const job = await queue.add(
            "test-lifecycle",
            {
                to: "test@example.com",
                subject: "Lifecycle Test",
            },
            {
                jobId,
                removeOnComplete: true,
                removeOnFail: true,
            }
        );

        logger.info(`📤 Job added: ${job.id}`);

        /**
         * 4. EVENT-BASED TRACKING
         */
        const timeout = setTimeout(() => {
            logger.error("⏰ TIMEOUT: Job not completed in 20s");
            process.exit(1);
        }, 20000);

        events.on("completed", ({ jobId: completedId }) => {
            if (completedId === job.id) {
                clearTimeout(timeout);
                logger.info("🎉 SUCCESS: Job completed");
                shutdown();
            }
        });

        events.on("failed", ({ jobId: failedId, failedReason }) => {
            if (failedId === job.id) {
                clearTimeout(timeout);
                logger.error(`❌ FAILED: ${failedReason}`);
                shutdown(1);
            }
        });

    } catch (err) {
        logger.fatal(`💥 TEST_CRASH: ${err.message}`);
        shutdown(1);
    }

    async function shutdown(code = 0) {
        await queue.close();
        await events.close();
        if (redis.status === "ready") await redis.quit();
        process.exit(code);
    }
}

runTest();