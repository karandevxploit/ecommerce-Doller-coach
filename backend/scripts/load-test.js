#!/usr/bin/env node

const autocannon = require("autocannon");
const { performance } = require("perf_hooks");
const fs = require("fs");

class ProductionLoadTest {
  constructor(baseUrl = "http://localhost:8001") {
    this.baseUrl = baseUrl;
    this.results = [];
    this.token = process.env.AUTH_TOKEN || "";
  }

  headers() {
    return {
      "Content-Type": "application/json",
      "User-Agent": "ProdLoadTest",
      ...(this.token && { Authorization: `Bearer ${this.token}` })
    };
  }

  buildRequests() {
    return [
      { method: "GET", path: "/api/products", weight: 30 },
      { method: "GET", path: "/api/products?q=shirt", weight: 15 },
      { method: "GET", path: "/api/products/filters", weight: 10 },
      { method: "GET", path: "/api/cart", weight: 10 },
      { method: "POST", path: "/api/cart", body: JSON.stringify({ productId: "1", qty: 1 }), weight: 10 },
      { method: "GET", path: "/api/orders/my", weight: 10 },
      { method: "GET", path: "/api/health", weight: 5 },
      { method: "GET", path: "/api/admin/stats", weight: 5 }
    ].map(r => ({ ...r, headers: this.headers() }));
  }

  async runScenario(connections, duration) {
    console.log(`🔥 ${connections} users for ${duration}s`);

    const result = await autocannon({
      url: this.baseUrl,
      connections,
      duration,
      timeout: 10,
      pipelining: 1,
      requests: this.buildRequests(),

      // THINK TIME
      setupClient: (client) => {
        client.setHeaders(this.headers());
        client.on("response", () => {
          const delay = Math.random() * 300 + 100;
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
    const errorRate = (result.errors / result.requests.total) * 100;

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
    const scenarios = [10, 100, 500, 1000];

    for (let c of scenarios) {
      const result = await this.runScenario(c, 30);
      const analysis = this.analyze(result, c);

      this.results.push(analysis);
      console.log(analysis);

      await new Promise(r => setTimeout(r, 10000));
    }

    this.report();
  }

  report() {
    console.log("\n📊 FINAL REPORT");

    this.results.forEach(r => {
      console.log(
        `${r.connections} users | Avg: ${Math.round(r.avgLatency)}ms | P95: ${Math.round(r.p95)}ms | Errors: ${r.errorRate.toFixed(2)}% | ${r.status}`
      );
    });

    fs.writeFileSync(
      "prod-load-report.json",
      JSON.stringify(this.results, null, 2)
    );

    console.log("\nSaved to prod-load-report.json");
  }
}

(async () => {
  const url = process.argv[2] || "http://localhost:8001";
  const tester = new ProductionLoadTest(url);
  await tester.run();
})();