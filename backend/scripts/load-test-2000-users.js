#!/usr/bin/env node

const autocannon = require("autocannon");
const { performance } = require("perf_hooks");
const fs = require("fs");

class LoadTest2000Users {
  constructor(baseUrl = "http://localhost:8001") {
    this.baseUrl = baseUrl;
    this.results = [];
    this.authToken = process.env.AUTH_TOKEN || "";
  }

  getHeaders() {
    return {
      "Content-Type": "application/json",
      "User-Agent": "LoadTest-Pro",
      ...(this.authToken && {
        Authorization: `Bearer ${this.authToken}`
      })
    };
  }

  /**
   * REALISTIC TRAFFIC PROFILE
   */
  buildRequests() {
    return [
      { method: "GET", path: "/api/products", weight: 30 },
      { method: "GET", path: "/api/products?q=shirt", weight: 15 },
      { method: "GET", path: "/api/products/filters", weight: 10 },
      { method: "GET", path: "/api/cart", weight: 10 },
      { method: "POST", path: "/api/cart", body: JSON.stringify({ productId: "123", qty: 1 }), weight: 10 },
      { method: "GET", path: "/api/orders/my", weight: 10 },
      { method: "GET", path: "/api/health", weight: 5 },
      { method: "GET", path: "/api/admin/stats", weight: 5 }
    ].map(r => ({
      ...r,
      headers: this.getHeaders()
    }));
  }

  async runScenario(connections, duration) {
    console.log(`Running ${connections} users for ${duration}s`);

    const result = await autocannon({
      url: this.baseUrl,
      connections,
      duration,
      pipelining: 1,
      timeout: 10,

      requests: this.buildRequests(),

      /**
       * THINK TIME (IMPORTANT)
       */
      setupClient: (client) => {
        client.setHeaders(this.getHeaders());
        client.on("response", () => {
          const delay = Math.random() * 200 + 100;
          client.pause();
          setTimeout(() => client.resume(), delay);
        });
      }
    });

    return result;
  }

  analyze(result, connections) {
    const avg = result.latency.average;
    const p95 = result.latency.p95;
    const errors = result.errors;
    const total = result.requests.total;

    const errorRate = (errors / total) * 100;

    let status = "PASS";

    if (avg > 400 || p95 > 1000 || errorRate > 5) {
      status = "FAIL";
    }

    return {
      connections,
      avgLatency: avg,
      p95,
      errorRate,
      throughput: result.requests.average,
      status
    };
  }

  async run() {
    const scenarios = [100, 500, 1000, 1500, 2000];

    for (let c of scenarios) {
      const result = await this.runScenario(c, c === 2000 ? 120 : 60);
      const analysis = this.analyze(result, c);

      this.results.push(analysis);

      console.log(analysis);
    }

    this.report();
  }

  report() {
    console.log("\nFINAL REPORT");

    this.results.forEach(r => {
      console.log(
        `${r.connections} users | Avg: ${Math.round(r.avgLatency)}ms | P95: ${Math.round(r.p95)}ms | Errors: ${r.errorRate.toFixed(2)}% | ${r.status}`
      );
    });

    /**
     * JSON EXPORT (CI/CD)
     */
    fs.writeFileSync(
      "load-test-report.json",
      JSON.stringify(this.results, null, 2)
    );

    console.log("\nSaved report to load-test-report.json");
  }
}

(async () => {
  const url = process.argv[2] || "http://localhost:8001";
  const tester = new LoadTest2000Users(url);
  await tester.run();
})();