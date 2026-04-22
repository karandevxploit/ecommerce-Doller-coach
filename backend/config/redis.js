const Redis = require("ioredis");
const { logger } = require("../utils/logger");

// ❗ Load REDIS_URL directly from process.env for absolute certainty
const REDIS_URL = process.env.REDIS_URL;

console.log("Using Redis URL:", REDIS_URL ? "Loaded ✅" : "Missing ❌");

if (!REDIS_URL) {
  console.error("❌ REDIS_URL missing in .env");
}

let redis = null;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("connect", async () => {
      console.log("✅ Redis Connected");
      logger.info("[REDIS_CONNECTED]");
      
      // OPTIMIZATION: Ensure no eviction for BullMQ safety
      try {
        await redis.config("SET", "maxmemory-policy", "noeviction");
        logger.info("[REDIS_CONFIG] Policy set to noeviction");
      } catch (err) {
        logger.warn("[REDIS_CONFIG_FAILED]", { error: err.message });
      }
    });

    redis.on("error", (err) => {
      console.error("❌ Redis Error:", err.message);
      logger.error("[REDIS_ERROR]", { message: err.message });
    });

  } catch (err) {
    console.error("❌ Redis Initialization Failed:", err.message);
  }
}

// ---------- HELPERS ----------

const isRedisReady = () => {
  return redis && redis.status === "ready";
};

const waitForReady = async (timeout = 8000) => {
  if (!redis) return;
  if (redis.status === "ready") return;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logger.warn("[REDIS_BOOT_TIMEOUT]");
      resolve();
    }, timeout);

    redis.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

const safeCall = async (fn) => {
  if (!isRedisReady()) return null;
  try {
    return await fn(redis);
  } catch (err) {
    logger.warn("[REDIS_FAIL]", { message: err.message });
    return null;
  }
};

module.exports = {
  redis,
  rawClient: redis, // Compatibility alias
  safeCall,
  isRedisReady,
  waitForReady,
};