/**
 * PRODUCTION-GRADE SECURITY STRESS TESTER
 * Covers:
 * - Rate Limiting
 * - CSRF Protection
 * - JWT Validation
 * - Concurrent Mixed Attacks
 * - Metrics (avg, p95, p99)
 */

const http = require("http");
const { performance } = require("perf_hooks");

const BASE_URL = process.env.BASE_URL || "http://localhost:8001";
const HOST = new URL(BASE_URL).hostname;
const PORT = new URL(BASE_URL).port || 80;

class SecurityStressTester {
  constructor() {
    this.results = [];
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve) => {
      const start = performance.now();

      const req = http.request(
        {
          hostname: HOST,
          port: PORT,
          path: endpoint,
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            const end = performance.now();

            resolve({
              statusCode: res.statusCode,
              duration: end - start,
              success: res.statusCode < 400,
              rateLimited: res.statusCode === 429,
              csrfError: res.statusCode === 403,
              jwtError: res.statusCode === 401,
            });
          });
        }
      );

      req.on("error", () => {
        resolve({
          statusCode: 0,
          duration: 10000,
          success: false,
          error: true,
        });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.setTimeout(10000, () => req.destroy());
      req.end();
    });
  }

  // ================= JWT FLOW =================
  async getValidToken() {
    const res = await this.makeRequest("/api/auth/login", {
      method: "POST",
      body: {
        email: "tester0@scale.com",
        password: "ScaleTest123!",
      },
    });

    try {
      const parsed = JSON.parse(res.data || "{}");
      return parsed.token || null;
    } catch {
      return null;
    }
  }

  // ================= RATE LIMIT =================
  async testRateLimit() {
    console.log("\n🚦 Testing Rate Limiting...");

    const requests = [];

    for (let i = 0; i < 200; i++) {
      requests.push(
        this.makeRequest("/api/products", {
          headers: {
            "X-Real-IP": `10.0.0.${i}`,
          },
        })
      );
    }

    const results = await Promise.all(requests);
    this.report("Rate Limit", results);
  }

  // ================= CSRF =================
  async testCSRF() {
    console.log("\n🛡️ Testing CSRF...");

    const noToken = [];
    const invalidToken = [];

    for (let i = 0; i < 50; i++) {
      noToken.push(
        this.makeRequest("/api/auth/login", {
          method: "POST",
          body: { email: "a@test.com", password: "123" },
        })
      );

      invalidToken.push(
        this.makeRequest("/api/auth/login", {
          method: "POST",
          headers: { "x-csrf-token": "fake" },
          body: { email: "a@test.com", password: "123" },
        })
      );
    }

    const results = [
      ...(await Promise.all(noToken)),
      ...(await Promise.all(invalidToken)),
    ];

    this.report("CSRF", results);
  }

  // ================= JWT =================
  async testJWT() {
    console.log("\n🔐 Testing JWT...");

    const invalid = [];
    const noToken = [];

    for (let i = 0; i < 50; i++) {
      noToken.push(this.makeRequest("/api/admin/stats"));

      invalid.push(
        this.makeRequest("/api/admin/stats", {
          headers: { Authorization: "Bearer invalid.token" },
        })
      );
    }

    const results = [
      ...(await Promise.all(noToken)),
      ...(await Promise.all(invalid)),
    ];

    this.report("JWT", results);
  }

  // ================= CONCURRENT =================
  async testConcurrent() {
    console.log("\n🔄 Testing Concurrent Security Load...");

    const batch = [];

    for (let i = 0; i < 100; i++) {
      batch.push(
        this.makeRequest(
          i % 2 === 0 ? "/api/products" : "/api/admin/stats",
          {
            headers:
              i % 2 === 0
                ? {}
                : { Authorization: "Bearer invalid.token" },
          }
        )
      );
    }

    const results = await Promise.all(batch);
    this.report("Concurrent", results);
  }

  // ================= METRICS =================
  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    return sorted[Math.floor((p / 100) * sorted.length)];
  }

  report(name, results) {
    const durations = results.map((r) => r.duration);

    const avg =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    const rateLimited = results.filter((r) => r.rateLimited).length;
    const jwtErrors = results.filter((r) => r.jwtError).length;
    const csrfErrors = results.filter((r) => r.csrfError).length;

    console.log(`\n📊 ${name} REPORT`);
    console.log(`Total: ${results.length}`);
    console.log(`Avg: ${Math.round(avg)}ms`);
    console.log(`P95: ${Math.round(p95)}ms`);
    console.log(`P99: ${Math.round(p99)}ms`);
    console.log(`RateLimited: ${rateLimited}`);
    console.log(`JWT Errors: ${jwtErrors}`);
    console.log(`CSRF Errors: ${csrfErrors}`);

    // Dynamic judgment
    if (rateLimited > results.length * 0.1) {
      console.log("✅ Rate limiting working");
    }

    if (jwtErrors > results.length * 0.5) {
      console.log("✅ JWT protection working");
    }

    if (csrfErrors > results.length * 0.5) {
      console.log("✅ CSRF protection working");
    }
  }

  // ================= RUN =================
  async run() {
    console.log("\n🔒 SECURITY STRESS TEST STARTED");

    await this.testRateLimit();
    await this.testCSRF();
    await this.testJWT();
    await this.testConcurrent();

    console.log("\n✅ ALL TESTS COMPLETED");
  }
}

// RUN
(async () => {
  const tester = new SecurityStressTester();
  await tester.run();
  process.exit(0);
})();