const os = require("os");
const Redis = require("ioredis");
const mongoose = require("mongoose");
const env = require("../config/env");
const { ok } = require("../utils/apiResponse");
const asyncHandler = require("express-async-handler");

let redis;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL);
}

exports.getPerformanceMetrics = asyncHandler(async (req, res) => {
  // 1. System Metrics
  const system = {
    uptime: process.uptime(),
    memory: {
      free: os.freemem(),
      total: os.totalmem(),
      percent: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1),
    },
    cpu: os.loadavg()[0].toFixed(2), // 1-minute load average
    node_version: process.version,
    platform: process.platform,
  };

  // 2. Performance Stats (Redis Sliding Window)
  let appMetrics = {
    total_requests: 0,
    total_errors: 0,
    avg_latency: 0,
    queue_length: 0,
  };

  if (redis) {
    // Collect keys for the last 5 minutes to determine "Real-Time" load
    const now = new Date();
    const minuteKeys = [];
    const errorKeys = [];
    
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getTime() - i * 60000);
      const suffix = `${d.getFullYear()}${d.getMonth()}${d.getDate()}${d.getHours()}${d.getMinutes()}`;
      minuteKeys.push(`perf:req:${suffix}`);
      errorKeys.push(`perf:err:${suffix}`);
    }

    const [reqCounts, errCounts, latencyList, queueLen] = await Promise.all([
      redis.mget(...minuteKeys),
      redis.mget(...errorKeys),
      redis.lrange("perf:global_latency", 0, -1),
      redis.llen("queue:email"),
    ]);

    const totalReq = reqCounts.reduce((acc, val) => acc + (parseInt(val) || 0), 0);
    const totalErr = errCounts.reduce((acc, val) => acc + (parseInt(val) || 0), 0);
    const avg = latencyList.length > 0 
      ? (latencyList.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / latencyList.length).toFixed(1)
      : 0;

    appMetrics = {
      total_requests: totalReq,
      total_errors: totalErr,
      avg_latency: parseFloat(avg),
      queue_length: queueLen || 0,
    };
  }

  // 3. Database Status
  const dbStatus = {
    connected: mongoose.connection.readyState === 1,
    name: mongoose.connection.name,
    host: mongoose.connection.host,
  };

  return ok(res, { system, appMetrics, dbStatus }, "Performance snapshot collected.");
});
