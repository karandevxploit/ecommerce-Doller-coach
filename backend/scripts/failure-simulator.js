#!/usr/bin/env node

const http = require("http");
const { performance } = require("perf_hooks");
const { URL } = require("url");

class FailureSimulator {
  constructor(baseUrl = "http://localhost:8001") {
    this.base = new URL(baseUrl);
    this.testResults = [];
    this.concurrency = 10;
    this.retries = 2;
  }

  async sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * RETRY WRAPPER
   */
  async requestWithRetry(fn) {
    let lastError;
    for (let i = 0; i <= this.retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        await this.sleep(200 * (i + 1));
      }
    }
    throw lastError;
  }

  /**
   * SAFE REQUEST
   */
  async makeRequest(endpoint, options = {}) {
    return this.requestWithRetry(() =>
      new Promise((resolve) => {
        const start = performance.now();

        const req = http.request(
          {
            hostname: this.base.hostname,
            port: this.base.port,
            path: endpoint,
            method: options.method || "GET",
            timeout: options.timeout || 5000,
            headers: {
              "Content-Type": "application/json",
              ...(process.env.AUTH_TOKEN && {
                Authorization: `Bearer ${process.env.AUTH_TOKEN}`
              }),
              ...options.headers
            }
          },
          (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
              const end = performance.now();
              resolve({
                endpoint,
                statusCode: res.statusCode,
                duration: end - start,
                success: res.statusCode < 500
              });
            });
          }
        );

        req.on("timeout", () => {
          req.destroy();
          resolve({
            endpoint,
            statusCode: 0,
            duration: 5000,
            success: false,
            error: "TIMEOUT"
          });
        });

        req.on("error", (err) => {
          resolve({
            endpoint,
            statusCode: 0,
            duration: 0,
            success: false,
            error: err.code || "ERROR"
          });
        });

        if (options.body) {
          req.write(JSON.stringify(options.body));
        }

        req.end();
      })
    );
  }

  /**
   * CONCURRENCY CONTROL
   */
  async runWithLimit(tasks) {
    const results = [];
    const queue = [...tasks];

    const workers = Array.from({ length: this.concurrency }).map(async () => {
      while (queue.length) {
        const task = queue.shift();
        if (task) {
          const res = await task();
          results.push(res);
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  /**
   * REDIS FAILURE
   */
  async simulateRedisDown() {
    console.log("\n🔴 Redis Failure Simulation\n");

    const endpoints = ["/api/products", "/api/health/deep"];

    const tasks = endpoints.map((ep) => () =>
      this.makeRequest(ep, {
        headers: { "X-Simulate-Redis-Down": "true" }
      })
    );

    const results = await this.runWithLimit(tasks);

    this.analyze("Redis Down", results);
  }

  /**
   * RATE LIMIT TEST
   */
  async simulateRateLimit() {
    console.log("\n🔴 Rate Limit Simulation\n");

    const tasks = Array.from({ length: 100 }).map((_, i) => () =>
      this.makeRequest("/api/products", {
        headers: { "X-Forwarded-For": `10.0.0.${i}` }
      })
    );

    const results = await this.runWithLimit(tasks);

    this.analyze("Rate Limit", results);
  }

  /**
   * ANALYSIS
   */
  analyze(name, results) {
    const success = results.filter((r) => r.success).length;
    const total = results.length;

    const avg =
      results.reduce((a, b) => a + b.duration, 0) / results.length;

    console.log(`📊 ${name}`);
    console.log(`Success: ${success}/${total}`);
    console.log(`Avg Latency: ${Math.round(avg)}ms`);

    this.testResults.push({ name, success, total });
  }

  async runAll() {
    await this.simulateRedisDown();
    await this.simulateRateLimit();
    this.summary();
  }

  summary() {
    console.log("\n📋 FINAL REPORT\n");

    this.testResults.forEach((r) => {
      console.log(`${r.name}: ${r.success}/${r.total}`);
    });
  }
}

/**
 * CLI
 */
(async () => {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const url = args[1] || "http://localhost:8001";

  const sim = new FailureSimulator(url);

  if (cmd === "all") {
    await sim.runAll();
  } else {
    await sim.simulateRedisDown();
  }
})();