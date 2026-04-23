const zlib = require("zlib");
const redis = require("../config/redis");
const { logger } = require("../utils/logger");

/**
 * ARCHITECT-LEVEL HYBRID CACHE SYSTEM
 * Features:
 * 1. Redis Primary / In-Memory Fallback
 * 2. In-Flight Request Deduplication (Stampede Protection)
 * 3. Gzip Compression for large payloads
 * 4. Automatic error handling
 */

class HybridCache {
  constructor() {
    // In-flight promises to deduplicate concurrent requests for the same key
    this.inFlight = new Map();
  }

  // =========================
  // CORE GET
  // =========================
  async get(key) {
    try {
      const data = await redis.get(key);
      if (!data) return null;

      return this.deserialize(data);
    } catch (err) {
      // redis.get already handles fallback internally in config/redis.js
      return null;
    }
  }

  // =========================
  // CORE SET
  // =========================
  async set(key, value, ttl = 60) {
    if (value === undefined || value === null) return;

    try {
      const serialized = JSON.stringify(value);
      const payload = serialized.length > 2048 
        ? zlib.gzipSync(serialized).toString("base64") 
        : serialized;

      await redis.set(key, payload, "EX", ttl);
      return true;
    } catch (err) {
      return false;
    }
  }

  // =========================
  // SMART GET-OR-SET (DEDUPLICATED)
  // =========================
  async getOrSet(key, fetchFn, ttl = 60) {
    // 1. Check if same request is already in flight
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    // 2. Wrap the fetch operation in a deduplicated promise
    const fetchPromise = (async () => {
      try {
        // Double check cache before fetching
        const cached = await this.get(key);
        if (cached) return cached;

        // Fetch fresh data
        const fresh = await fetchFn();
        
        // Background update cache (don't block)
        if (fresh) {
          this.set(key, fresh, ttl).catch(e => logger.error(`[CACHE_WRITE_ERR] ${key}: ${e.message}`));
        }

        return fresh;
      } finally {
        // Always clean up the in-flight map
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  // =========================
  // DELETE
  // =========================
  async del(key) {
    return redis.del(key);
  }

  // =========================
  // HELPERS
  // =========================
  deserialize(data) {
    try {
      // Detect if gzipped (base64 + likely header)
      if (data.length > 20 && !data.startsWith('{') && !data.startsWith('[')) {
        try {
          const decompressed = zlib.gunzipSync(Buffer.from(data, "base64")).toString();
          return JSON.parse(decompressed);
        } catch {
          return JSON.parse(data);
        }
      }
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }
}

module.exports = new HybridCache();