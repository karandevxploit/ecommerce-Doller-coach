const Redis = require("ioredis");
const { logger } = require("../utils/logger");

const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";
const REDIS_URL = process.env.REDIS_URL || DEFAULT_REDIS_URL;
const REDIS_ENABLED = !["false", "0", "no", "off"].includes(
  String(process.env.REDIS_ENABLED ?? "true").toLowerCase()
);

const COMMAND_TIMEOUT_MS = Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 750);
const CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1200);
const ERROR_LOG_INTERVAL_MS = Number(process.env.REDIS_ERROR_LOG_INTERVAL_MS || 60000);
const MAX_RECONNECT_ATTEMPTS = Number(process.env.REDIS_MAX_RECONNECT_ATTEMPTS || 1);
const MEMORY_MAX_KEYS = Number(process.env.MEMORY_CACHE_MAX_KEYS || 5000);

const toMs = (seconds) => Math.max(0, Number(seconds || 0) * 1000);

class MemoryRedis {
  constructor() {
    this.isMemory = true;
    this.status = "ready";
    this.store = new Map();
  }

  _purgeExpired(key) {
    const row = this.store.get(key);
    if (row?.expiresAt && row.expiresAt <= Date.now()) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  _prune() {
    while (this.store.size > MEMORY_MAX_KEYS) {
      const firstKey = this.store.keys().next().value;
      if (!firstKey) break;
      this.store.delete(firstKey);
    }
  }

  async get(key) {
    this._purgeExpired(key);
    return this.store.get(key)?.value ?? null;
  }

  async set(key, value, ...args) {
    let expiresAt = null;
    let nx = false;
    let xx = false;

    for (let i = 0; i < args.length; i += 1) {
      const token = String(args[i]).toUpperCase();
      if (token === "EX") {
        expiresAt = Date.now() + toMs(args[i + 1]);
        i += 1;
      } else if (token === "PX") {
        expiresAt = Date.now() + Number(args[i + 1] || 0);
        i += 1;
      } else if (token === "NX") {
        nx = true;
      } else if (token === "XX") {
        xx = true;
      }
    }

    this._purgeExpired(key);
    if (nx && this.store.has(key)) return null;
    if (xx && !this.store.has(key)) return null;

    this.store.set(key, { value: String(value), expiresAt });
    this._prune();
    return "OK";
  }

  async setex(key, seconds, value) {
    return this.set(key, value, "EX", seconds);
  }

  async del(...keys) {
    let count = 0;
    keys.flat().forEach((key) => {
      if (this.store.delete(key)) count += 1;
    });
    return count;
  }

  async incr(key) {
    const value = Number((await this.get(key)) || 0) + 1;
    await this.set(key, String(value));
    return value;
  }

  async expire(key, seconds) {
    this._purgeExpired(key);
    const row = this.store.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + toMs(seconds);
    return 1;
  }

  async ttl(key) {
    this._purgeExpired(key);
    const row = this.store.get(key);
    if (!row) return -2;
    if (!row.expiresAt) return -1;
    return Math.max(0, Math.ceil((row.expiresAt - Date.now()) / 1000));
  }

  async exists(key) {
    this._purgeExpired(key);
    return this.store.has(key) ? 1 : 0;
  }

  async scan(cursor = "0", _matchToken = "MATCH", pattern = "*", _countToken = "COUNT", count = 200) {
    const keys = [...this.store.keys()].filter((key) => {
      this._purgeExpired(key);
      if (pattern === "*") return true;
      const regex = new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      return regex.test(key);
    });
    const start = Number(cursor || 0);
    const next = start + Number(count || 200);
    return [next >= keys.length ? "0" : String(next), keys.slice(start, next)];
  }

  async keys(pattern = "*") {
    const [, found] = await this.scan("0", "MATCH", pattern, "COUNT", MEMORY_MAX_KEYS);
    return found;
  }

  async eval() {
    return null;
  }

  duplicate() {
    return this;
  }

  on() { return this; }
  once() { return this; }
  off() { return this; }
  disconnect() {}
  async quit() { this.store.clear(); }
}

class RedisWrapper {
  constructor() {
    this.client = null;
    this.memoryClient = new MemoryRedis();
    this._isReady = false;
    this.enabled = true;
    this.configured = REDIS_ENABLED;
    this.usingMemory = true;
    this.lastErrorLog = 0;
    this.maintenanceTimer = null;

    if (REDIS_ENABLED) {
      this.init();
    } else {
      this.useMemory("[REDIS_DISABLED] REDIS_ENABLED=false. Using local memory cache.");
    }
  }

  useMemory(reason) {
    this.client = this.memoryClient;
    this._isReady = true;
    this.enabled = true;
    this.usingMemory = true;
    logger.warn(reason);
  }

  init() {
    this.usingMemory = false;
    this.client = new Redis(REDIS_URL, {
      connectTimeout: CONNECT_TIMEOUT_MS,
      commandTimeout: COMMAND_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 10000,
      connectionName: process.env.REDIS_CONNECTION_NAME || `backend-${process.pid}`,
      retryStrategy: (times) => {
        if (times > MAX_RECONNECT_ATTEMPTS) {
          this.useMemory(`[REDIS_MEMORY_FALLBACK] Local Redis unavailable at ${REDIS_URL}`);
          return null;
        }
        return Math.min(times * 250, 1000);
      },
    });

    this.bindEvents();
    this.client.connect().catch((err) => {
      this.useMemory(`[REDIS_CONNECT_FAILED] ${err.message}. Using local memory cache.`);
    });
  }

  bindEvents() {
    this.client.on("connect", () => logger.info(`[REDIS] Connecting ${REDIS_URL}`));

    this.client.on("ready", async () => {
      this._isReady = true;
      this.enabled = true;
      this.usingMemory = false;
      logger.info(`[REDIS_READY] local=${REDIS_URL.includes("127.0.0.1") || REDIS_URL.includes("localhost")} pid=${process.pid}`);
      await this.logMemoryStats();
    });

    this.client.on("error", (err) => {
      this._isReady = false;
      this.enabled = true;
      this.logErrorOnce(`[REDIS_ERROR] ${err.message}`);
    });

    this.client.on("end", () => {
      if (!this.usingMemory) this.useMemory("[REDIS_ENDED] Using local memory cache.");
    });
  }

  async logMemoryStats() {
    if (this.usingMemory) {
      logger.info(`[MEMORY_CACHE_STATS] keys=${this.memoryClient.store.size} max=${MEMORY_MAX_KEYS}`);
      return;
    }

    try {
      const info = await this.client.info("memory");
      const used = info.match(/used_memory_human:(.*)/)?.[1]?.trim();
      const peak = info.match(/used_memory_peak_human:(.*)/)?.[1]?.trim();
      logger.info(`[REDIS_STATS] used=${used || "unknown"} peak=${peak || "unknown"}`);
    } catch (err) {
      logger.warn(`[REDIS_STATS_SKIP] ${err.message}`);
    }
  }

  logErrorOnce(message) {
    const now = Date.now();
    if (now - this.lastErrorLog > ERROR_LOG_INTERVAL_MS) {
      logger.error(message);
      this.lastErrorLog = now;
    }
  }

  async withTimeout(promise, label) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timeout`)), COMMAND_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async execute(method, ...args) {
    const target = this._isReady || this.usingMemory ? this.client : this.memoryClient;
    if (!target || typeof target[method] !== "function") return null;

    try {
      return await this.withTimeout(Promise.resolve(target[method](...args)), `Redis ${method}`);
    } catch (err) {
      this.logErrorOnce(`[CACHE_COMMAND_FAILED] ${method}: ${err.message}`);
      return null;
    }
  }

  get(key) { return this.execute("get", key); }
  set(key, value, ...args) { return this.execute("set", key, value, ...args); }
  del(...keys) { return this.execute("del", ...keys); }

  async safeCall(fn) {
    if (!this.client || typeof fn !== "function") return null;
    try {
      return await this.withTimeout(Promise.resolve(fn(this.client)), "Redis safeCall");
    } catch (err) {
      this.logErrorOnce(`[CACHE_SAFE_CALL_FAILED] ${err.message}`);
      return null;
    }
  }

  async waitForReady(timeout = 1500) {
    if (this._isReady) return true;
    if (!REDIS_ENABLED) return true;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this._isReady) this.useMemory("[REDIS_READY_TIMEOUT] Using local memory cache.");
        resolve(true);
      }, timeout);

      this.client.once("ready", () => {
        clearTimeout(timer);
        resolve(true);
      });
      this.client.once("error", () => {
        clearTimeout(timer);
        this.useMemory("[REDIS_READY_ERROR] Using local memory cache.");
        resolve(true);
      });
    });
  }

  startMaintenance() {
    if (this.maintenanceTimer) return;
    this.maintenanceTimer = setInterval(() => this.logMemoryStats().catch(() => {}), 300000);
    this.maintenanceTimer.unref?.();
  }

  async close() {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    this.maintenanceTimer = null;

    if (this.client && !this.usingMemory) {
      await this.client.quit().catch(() => this.client.disconnect());
    }
    this.memoryClient.store.clear();
    this._isReady = false;
  }

  isReady() { return this._isReady; }
  isMemory() { return this.usingMemory; }
  isRealRedisReady() { return this._isReady && !this.usingMemory; }
}

const instance = new RedisWrapper();
instance.startMaintenance();

module.exports = {
  redis: instance.client,
  rawClient: instance.client,
  safe: instance,
  safeCall: (fn) => instance.safeCall(fn),
  get: (key) => instance.get(key),
  set: (key, val, ...args) => instance.set(key, val, ...args),
  del: (...keys) => instance.del(...keys),
  waitForReady: (timeout) => instance.waitForReady(timeout),
  isReady: () => instance.isReady(),
  isRedisReady: () => instance.isReady(),
  isRealRedisReady: () => instance.isRealRedisReady(),
  isMemory: () => instance.isMemory(),
  enabled: () => instance.enabled,
  configured: () => instance.configured,
  close: () => instance.close(),
};
