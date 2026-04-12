const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const os = require("os");
const redis = require("../config/redis");
const logger = require("../utils/logger");
const env = require("../config/env");

/**
 * REAL-TIME PERFORMANCE & TELEMETRY SERVICE
 * Implements a high-frequency, event-driven data pipeline for system observability.
 */
class RealtimeService {
  constructor() {
    this.io = null;
    this.metricsInterval = null;
    this.activeInstances = new Set();
    this.instanceId = process.env.RENDER_INSTANCE_ID || `local-${Math.random().toString(36).substring(7)}`;
  }

  initialize(httpServer) {
    if (this.io) return;

    this.io = new Server(httpServer, {
      cors: {
        origin: env.CLIENT_URL ? env.CLIENT_URL.split(",") : "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 30000,
      pingInterval: 25000
    });

    // 1. Redis Adapter for Multi-Instance/Scaling Support
    if (redis && !redis.isMock) {
      try {
        const pubClient = redis;
        const subClient = pubClient.duplicate();
        this.io.adapter(createAdapter(pubClient, subClient));
        logger.info("RealtimeService: Redis Adapter initialized.");
      } catch (err) {
        logger.warn("RealtimeService: Redis Adapter failed to attach. Falling back to local adapter.", { error: err.message });
      }
    } else if (redis?.isMock) {
      logger.info("RealtimeService: Bypass Redis Adapter (Mock Active). Using local memory adapter.");
    }

    // 2. Connection Handlers
    this.io.on("connection", (socket) => {
      const isAdmin = socket.handshake.query.admin === "true";
      
      if (isAdmin) {
        socket.join("admins");
        logger.info(`Admin joined socket: ${socket.id}`);
        // Immediately send initial stats
        this.emitMetrics(socket);
      }

      socket.on("disconnect", () => {
        if (isAdmin) {
          logger.info(`Admin left socket: ${socket.id}`);
        }
      });
    });

    // 3. Start Telemetry Cycle
    this.startMetricsCollection();
    this.startInstanceHeartbeat();
    
    logger.info(`RealtimeService: Initialized on Instance ${this.instanceId}`);
  }

  /**
   * Track server scaling via Redis heartbeats
   */
  async startInstanceHeartbeat() {
    const HEARTBEAT_KEY = "telemetry:instances";
    
    const pulse = async () => {
      if (!redis) return;
      try {
        // Multi-set with TTL for each instance
        const now = Date.now();
        await redis.hset(HEARTBEAT_KEY, this.instanceId, now);
        // Expire instances that haven't pulsed in 60s
        const allInstances = await redis.hgetall(HEARTBEAT_KEY);
        for (const [id, lastPulse] of Object.entries(allInstances)) {
          if (now - parseInt(lastPulse) > 60000) {
            await redis.hdel(HEARTBEAT_KEY, id);
          }
        }
      } catch (err) {
        logger.warn("RealtimeService: Heartbeat failed", { error: err.message });
      }
    };

    pulse();
    setInterval(pulse, 30000); // 30s pulse
  }

  startMetricsCollection() {
    // 5-second telemetry resolution (Production Grade)
    this.metricsInterval = setInterval(() => {
      this.broadcastMetrics();
    }, 5000);
  }

  async getGlobalMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Scaling Detection
    let serverCount = 1;
    if (redis) {
      const instances = await redis.hgetall("telemetry:instances");
      serverCount = Object.keys(instances).length || 1;
    }

    // Active Users (Socket Count)
    // In multi-instance, this count is synchronized by the adapter
    const activeSockets = await this.io.allSockets();
    const activeUsers = activeSockets.size;

    // Crash Probability Logic
    // threshold: 1000 users per server
    const capacityPerServer = 1000;
    const currentLoad = activeUsers / (serverCount * capacityPerServer);
    let crashProbability = 0;
    
    if (currentLoad > 0.8) {
        crashProbability = Math.min(100, (currentLoad - 0.8) * 500); // Spikes after 80% load
    }

    return {
      activeUsers,
      serverCount,
      crashProbability: Math.round(crashProbability),
      resourceUsage: {
        cpu: os.loadavg()[0].toFixed(2),
        ram: {
          used: (usedMem / 1024 / 1024 / 1024).toFixed(2),
          total: (totalMem / 1024 / 1024 / 1024).toFixed(2),
          percent: ((usedMem / totalMem) * 100).toFixed(1)
        }
      },
      environment: process.env.RENDER ? "Production Cluster" : "Local Development",
      instanceId: this.instanceId,
      timestamp: new Date().toISOString()
    };
  }

  async broadcastMetrics() {
    if (!this.io) return;
    
    // Efficiency: Only broadcast if there are active admins
    const admins = await this.io.in("admins").allSockets();
    if (admins.size === 0) return;

    try {
      const metrics = await this.getGlobalMetrics();
      this.io.to("admins").emit("telemetry_update", metrics);
    } catch (err) {
      logger.warn("RealtimeService: Broadcast failed", { error: err.message });
    }
  }

  async emitMetrics(socket) {
    try {
      const metrics = await this.getGlobalMetrics();
      socket.emit("telemetry_update", metrics);
    } catch (err) {
      logger.warn("RealtimeService: Individual emit failed", { error: err.message });
    }
  }
}

const realtimeService = new RealtimeService();
module.exports = realtimeService;
