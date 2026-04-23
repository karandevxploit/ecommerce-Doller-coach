const Redis = require("ioredis");
const { logger } = require("../utils/logger");
const { LRUCache: LRU } = require("lru-cache");

const REDIS_URL = process.env.REDIS_URL;

/**
 * PRODUCTION-GRADE REDIS STABILITY LAYER
 * Implements:
 * 1. Exponential Backoff Connection
 * 2. 500ms Operation Timeouts
 * 3. In-Memory LRU Fallback (Hybrid)
 * 4. Rate-Limited Logging (Once per minute)
 */

class RedisWrapper {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.lastErrorLog = 0;
    
    // Safety Fallback (Strictly Bounded - Compliance: 30 items max)
    this.fallback = new LRU({
      max: 30,
      ttl: 1000 * 60 // 60 seconds (Compliance: Strict TTL)
    });

    if (REDIS_URL) {
      this.init();
    }
  }

  init() {
    this.client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 10000); // Exponential up to 10s
        return delay;
      },
      reconnectOnError: (err) => {
        if (err.message.includes("READONLY")) return true;
        return false;
      }
    });

    this.client.on("connect", () => {
      logger.info("📡 [REDIS] Connecting...");
    });

    this.client.on("ready", async () => {
      this.isReady = true;
      logger.info("✅ [REDIS] Connected & Ready");

      // PRODUCTION SCALABILITY: Ensure noeviction for BullMQ stability
      try {
        const config = await this.client.config("GET", "maxmemory-policy");
        const policy = config[1];
        
        if (policy !== "noeviction") {
          logger.warn(`⚠️ [REDIS_POLICY] Current: ${policy}. Attempting to set 'noeviction'...`);
          await this.client.config("SET", "maxmemory-policy", "noeviction");
          logger.info("✅ [REDIS_POLICY] Successfully set to 'noeviction'");
        } else {
          logger.info("✅ [REDIS_POLICY] 'noeviction' verified.");
        }

        const info = await this.client.info("memory");
        const used = info.match(/used_memory_human:(.*)/)?.[1];
        const peak = info.match(/used_memory_peak_human:(.*)/)?.[1];
        logger.info(`📊 [REDIS_STATS] Used: ${used} | Peak: ${peak}`);
      } catch (err) {
        logger.warn(`⚠️ [REDIS_CONFIG_SKIP] Could not verify/set policy: ${err.message}`);
      }
    });

    this.client.on("error", (err) => {
      this.isReady = false;
      if (err.message.includes("OOM") || err.message.includes("maxmemory")) {
        logger.fatal("🔥 [REDIS_OOM] Redis is full and cannot accept writes! BullMQ jobs at risk.");
      }
      this.logErrorOnce(`[REDIS_ERROR] ${err.message}`);
    });

    this.client.on("close", () => {
      this.isReady = false;
    });
  }

  logErrorOnce(msg) {
    const now = Date.now();
    if (now - this.lastErrorLog > 60000) {
      logger.error(msg);
      this.lastErrorLog = now;
    }
  }

  /**
   * SAFE CALL WITH TIMEOUT & FALLBACK (Safe Mode: Goal 4)
   */
  async execute(method, ...args) {
    const key = args[0];
    
    // 1. Try Redis if healthy
    if (this.isReady && this.client) {
      try {
        return await Promise.race([
          this.client[method](...args),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Redis Timeout")), 500))
        ]);
      } catch (err) {
        this.isReady = false; // Enter degraded mode
        this.logErrorOnce(`[REDIS_SAFE_MODE] ${method} failed, falling back to memory.`);
      }
    }

    // 2. Fallback to Local Memory (Strict Limit: 30 items)
    if ((method === "get" || method === "set") && key) {
       if (method === "get") return this.fallback.get(key) || null;
       if (method === "set") this.fallback.set(key, args[1], { ttl: args[3] ? args[3] * 1000 : 60000 });
    }

    return null;
  }

  async get(key) {
    return await this.execute("get", key);
  }

  /**
   * SET WITH FALLBACK
   */
  async set(key, val, mode, duration) {
    // Write to Redis
    await this.execute("set", key, val, mode, duration);
    
    // Also write to local fallback for immediate resilience
    const ttl = mode === "EX" ? duration * 1000 : 300000;
    this.fallback.set(key, val, { ttl });
  }

  async del(key) {
    this.fallback.delete(key);
    return this.execute("del", key);
  }

  /**
   * LEGACY COMPATIBILITY WRAPPER
   */
  async safeCall(fn) {
    if (!this.isReady || !this.client) return null;
    try {
      return await fn(this.client);
    } catch (err) {
      this.logErrorOnce(`[REDIS_SAFE_CALL_ERR] ${err.message}`);
      return null;
    }
  }

  async waitForReady(timeout = 3000) {
    if (this.isReady || !this.client) return;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeout);
      this.client.once("ready", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * PERIODIC MAINTENANCE
   */
  startMaintenance() {
    setInterval(() => {
      if (this.fallback) {
        if (typeof this.fallback.purgeStale === "function") this.fallback.purgeStale();
        else if (typeof this.fallback.prune === "function") this.fallback.prune();
      }
    }, 300000).unref(); // 5 minutes
  }
}

const instance = new RedisWrapper();
instance.startMaintenance();

module.exports = {
  redis: instance.client,
  rawClient: instance.client,
  safe: instance,
  safeCall: (fn) => instance.safeCall(fn),
  get: (key) => instance.get(key),
  set: (key, val, mode, dur) => instance.set(key, val, mode, dur),
  del: (key) => instance.del(key),
  waitForReady: (t) => instance.waitForReady(t),
  isReady: () => instance.isReady
};