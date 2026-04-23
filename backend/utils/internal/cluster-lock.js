/**
 * Redis-based Distributed Lock for Multi-Instance Safety
 * Prevents race conditions across multiple server instances
 */

const redisConfig = require('../../config/redis');
const { logger } = require('../logger');

class DistributedLock {
  constructor(options = {}) {
    this.redis = redisConfig.rawClient;
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
    this.retryDelay = options.retryDelay || 100; // 100ms
    this.maxRetries = options.maxRetries || 300; // 30 seconds max wait
  }

  /**
   * Acquire a distributed lock
   * @param {string} key - Lock key
   * @param {number} timeout - Lock timeout in ms
   * @param {string} identifier - Unique identifier for this lock holder
   * @returns {Promise<boolean>} - True if lock acquired
   */
  async acquire(key, timeout = this.defaultTimeout, identifier = null) {
    if (!this.redis) {
      logger.warn(`[DISTRIBUTED_LOCK] Redis not available - falling back to in-memory lock`);
      return this.acquireInMemory(key, timeout);
    }

    const lockKey = `lock:${key}`;
    const lockValue = identifier || `${process.pid}-${Date.now()}-${Math.random()}`;
    const timeoutSeconds = Math.ceil(timeout / 1000);

    try {
      // Use SET with NX and EX for atomic lock acquisition
      const result = await this.redis.set(lockKey, lockValue, 'EX', timeoutSeconds, 'NX');
      
      if (result === 'OK') {
        logger.debug(`[DISTRIBUTED_LOCK] Acquired lock: ${key} (${timeoutSeconds}s)`);
        
        // Set up automatic lock renewal for long-running operations
        this.setupRenewal(lockKey, lockValue, timeoutSeconds);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`[DISTRIBUTED_LOCK] Error acquiring lock ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Acquire lock with retry logic
   * @param {string} key - Lock key
   * @param {number} timeout - Lock timeout in ms
   * @param {number} maxWaitTime - Maximum time to wait for lock
   * @param {string} identifier - Unique identifier
   * @returns {Promise<boolean>} - True if lock acquired
   */
  async acquireWithRetry(key, timeout = this.defaultTimeout, maxWaitTime = 30000, identifier = null) {
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWaitTime) {
      if (await this.acquire(key, timeout, identifier)) {
        return true;
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));

      // Log progress for long waits
      if (attempts % 50 === 0) { // Every 5 seconds
        logger.debug(`[DISTRIBUTED_LOCK] Waiting for lock ${key}: ${attempts} attempts`);
      }
    }

    logger.warn(`[DISTRIBUTED_LOCK] Failed to acquire lock ${key} after ${attempts} attempts`);
    return false;
  }

  /**
   * Release a distributed lock
   * @param {string} key - Lock key
   * @param {string} identifier - Lock identifier (optional)
   * @returns {Promise<boolean>} - True if lock released
   */
  async release(key, identifier = null) {
    if (!this.redis) {
      return this.releaseInMemory(key);
    }

    const lockKey = `lock:${key}`;

    try {
      // Use Lua script for atomic release with ownership check
      const luaScript = `
        local lockKey = KEYS[1]
        local expectedValue = ARGV[1]
        local currentValue = redis.call('GET', lockKey)
        
        if currentValue == false then
          return 0  -- Lock doesn't exist
        end
        
        if expectedValue == "" or currentValue == expectedValue then
          return redis.call('DEL', lockKey)  -- Release if owner or no identifier check
        end
        
        return 0  -- Not the owner
      `;

      const result = await this.redis.eval(luaScript, 1, lockKey, identifier || '');
      
      if (result === 1) {
        logger.debug(`[DISTRIBUTED_LOCK] Released lock: ${key}`);
        return true;
      } else {
        logger.warn(`[DISTRIBUTED_LOCK] Failed to release lock ${key} - not owner or expired`);
        return false;
      }
    } catch (error) {
      logger.error(`[DISTRIBUTED_LOCK] Error releasing lock ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a lock exists
   * @param {string} key - Lock key
   * @returns {Promise<boolean>} - True if lock exists
   */
  async exists(key) {
    if (!this.redis) {
      return this.existsInMemory(key);
    }

    try {
      const result = await this.redis.exists(`lock:${key}`);
      return result === 1;
    } catch (error) {
      logger.error(`[DISTRIBUTED_LOCK] Error checking lock ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get remaining time on a lock
   * @param {string} key - Lock key
   * @returns {Promise<number>} - Remaining time in seconds
   */
  async ttl(key) {
    if (!this.redis) {
      return 0; // In-memory locks don't have TTL
    }

    try {
      return await this.redis.ttl(`lock:${key}`);
    } catch (error) {
      logger.error(`[DISTRIBUTED_LOCK] Error getting TTL for lock ${key}: ${error.message}`);
      return -1;
    }
  }

  /**
   * Setup automatic lock renewal
   * @private
   */
  setupRenewal(lockKey, lockValue, timeoutSeconds) {
    // Only renew if timeout is more than 10 seconds
    if (timeoutSeconds <= 10) return;

    const renewalInterval = (timeoutSeconds * 1000) * 0.7; // Renew at 70% of timeout

    const renew = async () => {
      try {
        const result = await this.redis.set(lockKey, lockValue, 'EX', timeoutSeconds, 'XX');
        if (result === 'OK') {
          logger.debug(`[DISTRIBUTED_LOCK] Renewed lock: ${lockKey}`);
          setTimeout(renew, renewalInterval);
        } else {
          logger.warn(`[DISTRIBUTED_LOCK] Failed to renew lock: ${lockKey}`);
        }
      } catch (error) {
        logger.error(`[DISTRIBUTED_LOCK] Error renewing lock: ${error.message}`);
      }
    };

    setTimeout(renew, renewalInterval);
  }

  // Fallback in-memory locks for when Redis is unavailable
  inMemoryLocks = new Map();

  acquireInMemory(key, timeout) {
    if (this.inMemoryLocks.has(key)) {
      return false;
    }

    const lockData = {
      timestamp: Date.now(),
      timeout: Date.now() + timeout,
      pid: process.pid
    };

    this.inMemoryLocks.set(key, lockData);
    logger.debug(`[IN_MEMORY_LOCK] Acquired lock: ${key}`);
    return true;
  }

  releaseInMemory(key) {
    const released = this.inMemoryLocks.delete(key);
    if (released) {
      logger.debug(`[IN_MEMORY_LOCK] Released lock: ${key}`);
    }
    return released;
  }

  existsInMemory(key) {
    const lock = this.inMemoryLocks.get(key);
    if (!lock) return false;

    // Check if lock has expired
    if (Date.now() > lock.timeout) {
      this.inMemoryLocks.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clean up expired in-memory locks
   */
  cleanupExpiredLocks() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, lock] of this.inMemoryLocks.entries()) {
      if (now > lock.timeout) {
        this.inMemoryLocks.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[IN_MEMORY_LOCK] Cleaned ${cleaned} expired locks`);
    }
  }
}

// Global instance
const distributedLock = new DistributedLock();

// Cleanup expired in-memory locks every minute
setInterval(() => {
  distributedLock.cleanupExpiredLocks();
}, 60000);

module.exports = distributedLock;
