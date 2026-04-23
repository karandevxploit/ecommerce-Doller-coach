const { monitorEventLoopDelay } = require("perf_hooks");
const v8 = require("v8");
const { logger } = require("../utils/logger");
const env = require("../config/env");

/**
 * PRODUCTION-GRADE SYSTEM MONITOR (Optimized)
 * 1. Tracks Event Loop Lag (Target < 100ms)
 * 2. Tracks Memory Heap (Absolute MB thresholds)
 * 3. Proactive GC management
 */

const histogram = monitorEventLoopDelay({ resolution: 10 });
histogram.enable();

const MONITOR_INTERVAL = 60000; // 60 seconds
const GC_INTERVAL = 300000;    // 5 minutes

let monitorStarted = false;

const startMonitoring = () => {
    if (monitorStarted) return;
    monitorStarted = true;

    // 1. Regular Health Check (60s)
    setInterval(() => {
        const lag = histogram.mean / 1e6;
        histogram.reset();

        const mem = process.memoryUsage();
        const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
        const heapLimitMB = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);

        // Calculate absolute safety margin
        const remainingMB = heapLimitMB - heapUsedMB;

        // CRITICAL: If less than 48MB remaining OR usage > 90% of HARD limit
        if (remainingMB < 48 || (heapUsedMB / heapLimitMB) > 0.9) {
            logger.error(`🚨 [MEMORY_CRITICAL] Heap: ${heapUsedMB}MB / ${heapLimitMB}MB (Only ${remainingMB}MB left). Triggering emergency GC.`);
            if (global.gc) {
                global.gc();
            }
        } else if (remainingMB < 100) {
            logger.warn(`⚠️ [MEMORY_WARNING] Heap: ${heapUsedMB}MB / ${heapLimitMB}MB. Memory getting tight.`);
        }

        // Silent log for production, more detailed for dev
        if (env.NODE_ENV !== "production" || remainingMB < 100 || lag > 100) {
            logger.info(`📊 [MONITOR] Heap: ${heapUsedMB}MB/${heapLimitMB}MB | Lag: ${lag.toFixed(2)}ms | RSS: ${Math.round(mem.rss/1024/1024)}MB`);
        }

    }, MONITOR_INTERVAL).unref();

    // 2. Strict GC Cycle (Safe background cleanup)
    setInterval(() => {
        if (global.gc) {
            const before = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            global.gc();
            const after = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            if (before - after > 20) {
                logger.info(`🧹 [GC] Cleaned up ${before - after}MB of heap.`);
            }
        }
    }, GC_INTERVAL).unref();
};

module.exports = { startMonitoring };
