const Redis = require("ioredis");
const env = require("../config/env");

let redis;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL);
}

/**
 * Performance Monitoring Middleware
 * Tracks real-time latency and success rates per route.
 * Excludes monitoring noise to reflect true system state.
 */
const EXCLUDED_PATHS = ["/api/admin/performance", "/health", "/", "/api/config", "/favicon.ico"];

const performanceTracker = (req, res, next) => {
  if (!redis) return next();

  const start = process.hrtime();
  const path = req.originalUrl.split("?")[0];

  // Skip telemetry for monitoring endpoints to prevent Observer Effect
  if (EXCLUDED_PATHS.includes(path)) {
    return next();
  }

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const route = req.route ? req.route.path : path;
    const method = req.method;
    const status = res.statusCode;

    // Time-bucketing for real-time sliding window
    const now = new Date();
    const minuteKey = `perf:req:${now.getFullYear()}${now.getMonth()}${now.getDate()}${now.getHours()}${now.getMinutes()}`;
    const errorMinuteKey = `perf:err:${now.getFullYear()}${now.getMonth()}${now.getDate()}${now.getHours()}${now.getMinutes()}`;

    const pipeline = redis.pipeline();

    // 1. Sliding Window Counters (10 minute TTL)
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 600); 

    if (status >= 400) {
      pipeline.incr(errorMinuteKey);
      pipeline.expire(errorMinuteKey, 600);
      
      // Global error counter for legacy support (24h)
      pipeline.incr("perf:total_errors");
      pipeline.expire("perf:total_errors", 86400);
    }

    // 2. Track Route Latency (Rolling List)
    const routeKey = `perf:latency:${method}:${route}`;
    pipeline.lpush(routeKey, durationMs);
    pipeline.ltrim(routeKey, 0, 49);
    pipeline.expire(routeKey, 3600); // 1h latency history

    // 3. Global Latency moving average (Rolling List)
    pipeline.lpush("perf:global_latency", durationMs);
    pipeline.ltrim("perf:global_latency", 0, 99);
    pipeline.expire("perf:global_latency", 3600);

    pipeline.exec().catch(() => {});
  });

  next();
};

module.exports = performanceTracker;
