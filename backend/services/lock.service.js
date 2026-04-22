const Redlock = require("redlock").default;
const redis = require("../config/redis");
const { logger } = require("../utils/logger");

/**
 * DISTRIBUTED LOCKING SERVICE (REDLOCK)
 * Prevents race conditions across multiple server instances for critical sections
 * like payment verification, background jobs, and concurrent database writes.
 */
class LockService {
  constructor() {
    this.redlock = null;
    
    if (redis) {
      try {
        this.redlock = new Redlock([redis], {
          // The expected clock drift; for more check http://redis.io/topics/distlock
          driftFactor: 0.01, 
          // The max number of times Redlock will attempt to lock a resource before erroring.
          retryCount: 10,
          // The time in ms between attempts.
          retryDelay: 200, 
          // The max time in ms randomly added to retries to improve performance under high contention.
          retryJitter: 200, 
          // The minimum remaining time on a lock before a renewal is attempted.
          automaticExtensionThreshold: 500,
        });

        this.redlock.on("error", (err) => {
          // Ignore "LockError" as it's a normal occurrence when a lock is already held.
          if (err.name === "LockError") return;
          logger.error("[REDLOCK_CRITICAL_ERROR]", { message: err.message });
        });
        
        logger.info("[REDLOCK] Distributed locking engine initialized.");
      } catch (err) {
        logger.error("[REDLOCK_INIT_FAILED]", { error: err.message });
      }
    }
  }

  /**
   * Executes a callback function within a distributed lock context.
   * Ensures mutual exclusion across all server instances.
   * 
   * @param {string} resource - Unique identifier for the lock (e.g., "order:123")
   * @param {number} ttl - Time-to-live in milliseconds (how long until it auto-expires)
   * @param {Function} fn - The critical section to execute
   */
  async runLocked(resource, ttl, fn) {
    if (!this.redlock) {
      logger.error(`[LOCK_FATAL] Redlock offline. Blocking execution to prevent state corruption: ${resource}`);
      throw new Error("Synchronization engine is offline. Critical action blocked. Please try again later.");
    }

    let lock;
    try {
      // 1. Attempt to acquire the lock
      lock = await this.redlock.acquire([resource], ttl);
      logger.info(`[LOCK_ACQUIRED] Resource: ${resource}`);

      // 2. Execute the critical section
      return await fn();
    } catch (err) {
      if (err.name === "LockError") {
        logger.warn(`[LOCK_CONTENTION] Access denied for ${resource}. Resource is currently locked by another process.`);
        throw new Error("Resource is currently in use. Please try again in a few seconds.");
      }
      throw err;
    } finally {
      // 3. Guaranteed release
      if (lock) {
        try {
          await lock.release();
          logger.info(`[LOCK_RELEASED] Resource: ${resource}`);
        } catch (err) {
          // Only log if it's not a 'lock expired' error
          logger.error(`[LOCK_RELEASE_FAIL] ${resource}: ${err.message}`);
        }
      }
    }
  }
}

const lockService = new LockService();
module.exports = lockService;
