const Redis = require("ioredis");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const TIMEOUT = 5000;

/**
 * SAFE TIMEOUT WRAPPER
 */
const withTimeout = (promise, label) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout`)), TIMEOUT)
        ),
    ]);
};

/**
 * MAIN DIAGNOSTIC
 */
async function diagnose() {
    const url = process.env.REDIS_URL;

    if (!url) {
        console.error("❌ REDIS_URL not defined");
        process.exit(1);
    }

    console.log(`🔍 Diagnosing Redis: ${url}`);

    const client = new Redis(url, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
    });

    client.on("error", (err) => {
        console.error("❌ Redis Error:", err.message);
    });

    try {
        await client.connect();

        /**
         * 1. PING TEST
         */
        const pingStart = Date.now();
        await withTimeout(client.ping(), "PING");
        const latency = Date.now() - pingStart;

        /**
         * 2. READ/WRITE TEST
         */
        const testKey = `healthcheck:${Date.now()}`;

        await withTimeout(client.set(testKey, "ok", "EX", 5), "SET");
        const value = await withTimeout(client.get(testKey), "GET");

        if (value !== "ok") {
            throw new Error("Data integrity failed");
        }

        /**
         * 3. MEMORY + STATS
         */
        const info = await withTimeout(client.info("memory"), "INFO");

        const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
        const fragmentation = info.match(/mem_fragmentation_ratio:(\d+\.\d+)/)?.[1];

        /**
         * 4. POLICY
         */
        const policy = await withTimeout(
            client.config("GET", "maxmemory-policy"),
            "CONFIG"
        );

        /**
         * OUTPUT
         */
        const result = {
            status: "healthy",
            latencyMs: latency,
            memoryBytes: Number(usedMemory || 0),
            fragmentationRatio: Number(fragmentation || 0),
            evictionPolicy: policy?.[1] || "unknown",
        };

        console.log("✅ Redis Health:", JSON.stringify(result, null, 2));

        await client.quit();
        process.exit(0);

    } catch (err) {
        console.error("❌ Redis Diagnostic Failed:", err.message);

        try {
            await client.quit();
        } catch { }

        process.exit(1);
    }
}

diagnose();