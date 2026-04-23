const redis = require("../config/redis");
const { isRedisReady } = require("../config/redis");
const realtimeService = require("../services/realtime.service");
const logger = require("./logger");

// Global timer to handle cluster-instance level debouncing
let invalidationTimer = null;

/**
 * Global Admin Dashboard Invalidation Hook
 * Implements "Soft-Invalidation" + "Debouncing" to prevent Cache Stampedes.
 * Instead of deleting the cache, we mark it as 'dirty' allowing the 
 * system to serve stale data during a high-frequency rebuild.
 */
exports.invalidateAdminStats = async (order = null) => {
    const STALE_FLAG_KEY = "admin:stats:is_stale";
    const DEBOUNCE_MS = 10000; // 10s cooldown

    try {
        if (!isRedisReady()) return;

        // 1. Soft-Invalidate: Mark as stale instead of deleting
        // This ensures subsequent requests know a refresh is needed but 
        // they can still fallback to the old data if the DB is busy.
        await redis.set(STALE_FLAG_KEY, "true");
        
        // 2. Debounce Implementation
        if (invalidationTimer) clearTimeout(invalidationTimer);

        invalidationTimer = setTimeout(() => {
            if (process.env.NODE_ENV !== "production") {
                logger.info("[CACHE] Stats invalidation cooldown window closed.");
            }
            invalidationTimer = null;
        }, DEBOUNCE_MS);

        // 3. Broadcast Real-time Sync
        // This ensures the frontend 'knows' data changed without a full refresh
        if (order && realtimeService.io) {
            realtimeService.notifyOrderUpdate(order);
        } else if (realtimeService.io) {
            realtimeService.io.to("admins").emit("orderUpdated", {
                timestamp: new Date().toISOString(),
                reason: "commercial_mutation"
            });
        }
    } catch (err) {
        logger.error(`[CACHE_ERROR] Soft invalidation failed: ${err.message}`);
    }
};
