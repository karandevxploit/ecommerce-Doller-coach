const autocannon = require("autocannon");
const { logger } = require("../utils/logger");

/**
 * PRODUCTION LOAD TEST SUITE
 * Progressively tests system limits (1k -> 5k -> 10k users)
 */

async function runTest(connections, duration = 30) {
    console.log(`\n🚀 STARTING LOAD TEST: ${connections} CONCURRENT USERS`);
    
    const result = await autocannon({
        url: "http://localhost:8001/api/products", // Public list is best for stressing
        connections: connections,
        duration: duration,
        pipelining: 1,
        headers: {
            "accept-encoding": "gzip"
        }
    });

    console.log(`\n📊 RESULTS FOR ${connections} USERS:`);
    console.log(`- Requests/Sec: ${result.requests.average}`);
    console.log(`- P95 Latency: ${result.latency.p95}ms`);
    console.log(`- Errors: ${result.errors}`);
    console.log(`- Timeouts: ${result.timeouts}`);
    
    return result;
}

async function main() {
    try {
        // Phase 1: Normal Load
        await runTest(1000);

        // Phase 2: High Load
        await runTest(5000);

        // Phase 3: Stress Load
        await runTest(10000);

        console.log("\n✅ LOAD TEST SEQUENCE COMPLETE");
        process.exit(0);
    } catch (err) {
        console.error("Load test failed:", err);
        process.exit(1);
    }
}

main();
