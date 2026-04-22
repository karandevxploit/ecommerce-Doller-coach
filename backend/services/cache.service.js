const zlib = require("zlib");
const LRU = require("lru-cache");
const redisConfig = require("../config/redis");
const { logger } = require("../utils/logger");

class PerformanceCache {
  constructor() {
    this.redis = redisConfig.rawClient;

    this.memoryCache = new LRU({
      max: 1000,
      ttl: 1000 * 300 // 5 min
    });

    this.locks = new Map(); // stampede protection
  }

  // =========================
  // GET
  // =========================
  async get(key) {
    // 🔹 Memory
    const mem = this.memoryCache.get(key);
    if (mem) return mem;

    // 🔹 Redis
    if (!this.redis) return null;

    try {
      const val = await this.redis.get(key);
      if (!val) return null;

      const parsed = this.deserialize(val);

      this.memoryCache.set(key, parsed);
      return parsed;

    } catch (err) {
      logger.error("[CACHE] Redis get failed:", err.message);
      return null;
    }
  }

  // =========================
  // SET
  // =========================
  async set(key, value, ttl = 300) {
    try {
      const serialized = JSON.stringify(value);

      const compressed =
        serialized.length > 1024
          ? zlib.gzipSync(serialized).toString("base64")
          : serialized;

      this.memoryCache.set(key, value);

      if (this.redis) {
        await this.redis.setex(key, ttl, compressed);
      }

      return true;
    } catch (err) {
      logger.error("[CACHE] set failed:", err.message);
      return false;
    }
  }

  // =========================
  // DELETE
  // =========================
  async del(key) {
    this.memoryCache.delete(key);

    if (this.redis) {
      await this.redis.del(key);
    }
  }

  // =========================
  // SCAN INVALIDATION (FIXED)
  // =========================
  async invalidatePattern(pattern) {
    if (!this.redis) return;

    const stream = this.redis.scanStream({
      match: pattern,
      count: 100
    });

    for await (const keys of stream) {
      if (keys.length) {
        await this.redis.del(...keys);
      }
    }
  }

  // =========================
  // STAMPEDE PROTECTION
  // =========================
  async getOrSet(key, fetchFn, ttl = 300) {
    const cached = await this.get(key);
    if (cached) return cached;

    if (this.locks.has(key)) {
      return this.locks.get(key);
    }

    const promise = (async () => {
      const fresh = await fetchFn();
      await this.set(key, fresh, ttl);
      this.locks.delete(key);
      return fresh;
    })();

    this.locks.set(key, promise);
    return promise;
  }

  // =========================
  // DESERIALIZE (SAFE)
  // =========================
  deserialize(data) {
    try {
      // Try decompress
      try {
        const decompressed = zlib
          .gunzipSync(Buffer.from(data, "base64"))
          .toString();
        return JSON.parse(decompressed);
      } catch {
        return JSON.parse(data);
      }
    } catch (err) {
      logger.error("[CACHE] deserialize failed:", err.message);
      return null;
    }
  }
}

module.exports = new PerformanceCache();