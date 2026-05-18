

// 1. INITIALIZE ENVIRONMENT
const RUNTIME_PID = process.pid;
const RUNTIME_START = Date.now();
console.log(`\n🔵 [RUNTIME_START] PID=${RUNTIME_PID}, Timestamp=${new Date().toISOString()}\n`);

require("dotenv").config();
const fs = require("fs");
const path = require("path");
require("./config/mongooseCompat");

const { validateStartup } = require("./utils/internal/startup-validation");
validateStartup();

const cluster = require("cluster");
const os = require("os");
const lockManager = require("./utils/internal/lock-manager");

const { logger, chalk } = require("./utils/logger");
const env = require("./config/env");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const http = require("http");
const metricsService = require("./services/metrics.service");
let runtimeDeps = null;
const getRuntimeDeps = () => {
    if (!runtimeDeps) {
        const redisClient = require("./config/redis");
        const { initializeAllQueues, heavyTaskQueue } = require("./services/queue.service");
        const { startOutboxWorker, stopOutboxWorker } = require("./services/outbox.service");
        const shiprocketService = require("./services/shiprocket.service");
        runtimeDeps = {
            redisClient,
            initializeAllQueues,
            heavyTaskQueue,
            startOutboxWorker,
            stopOutboxWorker,
            shiprocketService,
        };
    }
    return runtimeDeps;
};

const compression = require("compression");
const xss = require("xss-clean");

let routeRegistrationCount = 0;
let isShuttingDown = false;

const parseAllowedOrigins = () => {
    const configured = [
        env.CLIENT_URL,
        env.FRONTEND_URL,
        env.PUBLIC_BACKEND_URL,
        ...(env.CORS_ORIGINS || "").split(","),
    ];

    return new Set(
        configured
            .map((origin) => String(origin || "").trim())
            .filter(Boolean)
    );
};

const countRegisteredRoutes = (appInstance) => {
    const stack = appInstance?._router?.stack || [];
    return stack.filter((layer) => layer.route || layer.name === "router").length;
};

/**
 * PRODUCTION-GRADE CRASH SAFETY
 */
const handleFatalError = (type, err) => {
    if (isShuttingDown) return;
    logger.fatal(`💥 ${type}:`, { message: err.message, stack: err.stack });
    try {
        const fs = require('fs');
        fs.appendFileSync('FATAL_CRASH.log', `\n[${new Date().toISOString()}] ${type}: ${err.message}\n${err.stack}\n`);
    } catch (e) { }

    // Graceful exit attempt
    if (type === "UNCAUGHT_EXCEPTION" || type === "STARTUP_FATAL" || type === "EADDRINUSE") {
        setTimeout(() => process.exit(1), 2000);
    }
};

process.on("unhandledRejection", (err) => {
  handleFatalError("UNHANDLED_REJECTION", err instanceof Error ? err : new Error(String(err)));
});

process.on("uncaughtException", (err) => {
  handleFatalError("UNCAUGHT_EXCEPTION", err);
});

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// 🛡️ PRODUCTION-GRADE CORS CONFIGURATION
const allowedOrigins = parseAllowedOrigins();
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || env.NODE_ENV === "development") {
      return callback(null, true);
    }
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-Idempotency-Key",
    "x-idempotency-key",
    "Idempotency-Key",
    "idempotency-key",
  ],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// Debug CORS preflights
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    logger.debug(`[CORS_PREFLIGHT] ${req.url} from ${req.headers.origin}`);
  }
  next();
});

// --- 0. STABILIZATION & LOAD CONTROL (EMERGENCY LAYER) ---
const { requestIdMiddleware: requestId } = require("./middlewares/requestId.middleware");
const { timeoutMiddleware, loadShedder, requestCounter } = require("./middlewares/loadControl.middleware");

app.use(requestCounter);       // 1. Precise active request tracking
app.use(requestId);            // 2. Traceability
app.use(require("./middlewares/metrics.middleware")); // 3. Performance Metrics
app.use((req, res, next) => {
    return timeoutMiddleware(15000)(req, res, next);
});
app.use(loadShedder);          // 5. Proactive Shedding

const { dedup } = require("./middlewares/dedup.middleware");
app.use(dedup(1));             // 6. Request Deduplication (1s window)

// 🩺 LIGHTWEIGHT HEALTH MONITOR (PRE-MIDDLEWARE)
app.get("/health", (_req, res) => {
    return res.status(200).json({ status: "ok" });
});
app.get("/metrics", (req, res) => {
    const { getWorkerStats } = require("./services/outbox.service");
    return res.status(200).json({
        timestamp: new Date().toISOString(),
        pid: RUNTIME_PID,
        uptime: Date.now() - RUNTIME_START,
        outbox: getWorkerStats(),
        routes: routeRegistrationCount,
        metrics: metricsService.snapshot(),
    });
});
app.get("/warmup", async (req, res) => {
    try {
        const { redisClient } = getRuntimeDeps();
        const connectDB = require("./config/db");
        await connectDB();
        const redisEnabled = env.REDIS_ENABLED && redisClient.enabled();
        if (redisEnabled) {
            await redisClient.waitForReady(1000);
        }
        const { getWorkerStats } = require("./services/outbox.service");
        return res.status(200).json({
            success: true,
            warmed: true,
            dbReady: connectDB.isConnected(),
            redisReady: redisEnabled,
            outboxWorker: getWorkerStats(),
            pid: RUNTIME_PID,
        });
    } catch (err) {
        return res.status(503).json({
            success: false,
            warmed: false,
            message: err.message,
            pid: RUNTIME_PID,
        });
    }
});

// --- 1. CORE SECURITY & PERFORMANCE LAYER ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));
app.use(cookieParser());

// 💓 API HEARTBEAT (Consolidated below)

app.use(compression());

// STANDARD BODY PARSERS - Optimized for high throughput
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Protection against common exploits.
app.use(xss());

app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        // CLEAN LOG OUTPUT (Step 3)
        if (status < 400) {
            console.log(`✅ ${req.method} ${req.originalUrl} ${status} - ${duration}ms`);
        } else {
            console.error(`❌ ${req.method} ${req.originalUrl} ${status} - ${duration}ms`);
        }
    });
    next();
});

if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
}

// 🚀 HTTP CACHING MIDDLEWARE (Production UX Optimization)
app.use((req, res, next) => {
    if (req.method === "GET") {
        const path = req.path;
        // Cache static products and offers for 5 mins in browser, 1 hour in CDN
        if (path.startsWith("/api/products") || path.startsWith("/api/offers")) {
            res.set("Cache-Control", "public, max-age=300, s-maxage=3600");
        }
    }
    next();
});

// 📂 STATIC ASSETS SERVING
const UPLOADS_DIR = path.join(__dirname, "uploads");
const LEGACY_UPLOADS_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
        fallthrough: true,
        maxAge: "30d",
        immutable: true,
        etag: true,
        lastModified: true,
        setHeaders(res) {
            res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        },
    })
);
app.use(
    "/uploads",
    express.static(LEGACY_UPLOADS_DIR, {
        fallthrough: true,
        maxAge: "30d",
        immutable: true,
        etag: true,
        lastModified: true,
        setHeaders(res) {
            res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        },
    })
);
app.use(express.static(path.join(__dirname, "assets")));

// --- 2. RATE LIMITING (ROUTE-SPECIFIC) ---
const { authLimiter, apiLimiter, dashboardLimiter, uploadLimiter } = require("./middlewares/rateLimiter.v2");

// --- 3. FULL ROUTE MAPPING (UNIFIED TREE) ---
app.use("/api/auth", authLimiter, require("./routes/auth.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/orders", apiLimiter, require("./routes/order.routes"));
app.use("/api/payments", apiLimiter, require("./routes/payment.routes"));
app.use("/api/cart", require("./routes/cart.routes"));
app.use("/api/wishlists", require("./routes/wishlist.routes"));
app.use("/api/reviews", require("./routes/review.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/coupons", require("./routes/coupon.routes"));
app.use("/api/offers", require("./routes/offer.routes"));
app.use("/api/config", require("./routes/config.routes"));
app.use("/api/delivery", apiLimiter, require("./routes/delivery.routes"));
app.use("/api/address", require("./routes/address.routes"));

// ADMIN SYSTEM (CONSOLIDATED)
app.use("/api/admin", dashboardLimiter, require("./routes/admin.routes"));
// app.use("/api/uploads", require("./routes/upload.routes")); // Removed duplicate

app.use("/api/site-content", require("./routes/siteContent.routes"));

app.use("/api/webhooks/shiprocket", require("./routes/shiprocket.routes"));
app.use("/api/shiprocket", require("./routes/shiprocket.routes"));

app.get("/api", (req, res) => {
    const { getWorkerStats } = require("./services/outbox.service");
    res.status(200).json({
        message: "Welcome to Doller Coach API",
        version: "1.0.0",
        status: "Healthy",
        runtime: getRuntimeStatus(),
        outbox: getWorkerStats(),
    });
});

app.use("/api/uploads", uploadLimiter, require("./routes/upload.routes"));
routeRegistrationCount = countRegisteredRoutes(app);

// Serve the built frontend from the same backend port. This keeps ngrok simple:
// expose only backend PORT and both website + API work on one host.
const FRONTEND_DIST_DIR = path.join(__dirname, "..", "frontend", "dist");
const FRONTEND_INDEX_FILE = path.join(FRONTEND_DIST_DIR, "index.html");
if (fs.existsSync(FRONTEND_INDEX_FILE)) {
    app.use(
        express.static(FRONTEND_DIST_DIR, {
            fallthrough: true,
            maxAge: "1h",
            etag: true,
            lastModified: true,
            setHeaders(res, filePath) {
                if (filePath.includes(`${path.sep}assets${path.sep}`)) {
                    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                }
            },
        })
    );

    app.get("*", (req, res, next) => {
        if (
            req.path.startsWith("/api") ||
            req.path.startsWith("/uploads") ||
            req.path === "/health" ||
            req.path === "/metrics" ||
            req.path === "/warmup"
        ) {
            return next();
        }

        return res.sendFile(FRONTEND_INDEX_FILE);
    });
} else {
    logger.warn("[FRONTEND_STATIC_MISSING] Run frontend build before one-port start.", {
        expected: FRONTEND_INDEX_FILE,
    });
}

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const getRuntimeStatus = () => ({
  pid: RUNTIME_PID,
  uptime: Date.now() - RUNTIME_START,
  routes: routeRegistrationCount,
});
app.use(notFound);
app.use(errorHandler);

let serverStarted = false;

const bootstrap = async () => {
    if (serverStarted) {
        console.error(`[BOOTSTRAP_CRITICAL] Bootstrap already called! PID=${RUNTIME_PID}`);
        logger.error("BOOTSTRAP_ALREADY_STARTED_ATTEMPT");
        return;
    }
    serverStarted = true;
    console.log(`[BOOTSTRAP_START] PID=${RUNTIME_PID}`, new Date().toISOString());

    const PORT = process.env.PORT || 8001;
    const server = http.createServer(app);
    server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 65000);
    server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 66000);
    server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 30000);
    server.maxRequestsPerSocket = Number(process.env.HTTP_MAX_REQUESTS_PER_SOCKET || 1000);
    const {
        redisClient,
        initializeAllQueues,
        heavyTaskQueue,
        startOutboxWorker,
        stopOutboxWorker,
        shiprocketService,
    } = getRuntimeDeps();

    try {
        // 1. Database is mandatory for API boot.
        await connectDB();
        if (!connectDB.isConnected()) {
            throw new Error("[BOOT_ABORT] MySQL connection not ready");
        }
        logger.info("[BOOT] MySQL ready, continuing startup.");

        // 2. Redis Second
        if (env.REDIS_ENABLED) {
            await redisClient.waitForReady();
        }

        // 4. Queues last
        if (env.REDIS_ENABLED && process.env.ENABLE_QUEUE === "true") {
            try {
                await initializeAllQueues();
            } catch (err) {
                logger.warn(`[QUEUE_INIT_SKIPPED] ${err.message}`);
            }
        } else {
            console.log("🔕 Queues disabled via ENABLE_QUEUE or REDIS_ENABLED=false");
        }
        // 5. Background Tasks
        if (process.env.ENABLE_OUTBOX === "true") {
            startOutboxWorker();
            
            setInterval(() => {
                const { getWorkerStats } = require("./services/outbox.service");
                const stats = getWorkerStats();
                console.log(`[WORKER_STATS] Execs:${stats.executionCount} | Uptime:${Math.round(stats.uptime/1000)}s`);
            }, 60000).unref();
        } else {
            console.log("🔕 Outbox worker disabled via ENABLE_OUTBOX");
        }
        setInterval(() => {
            if (env.REDIS_ENABLED) {
                heavyTaskQueue.add("shiprocket-tracking-sync", {}).catch((err) => {
                    logger.error({ error: err.message }, "SHIPROCKET_TRACKING_CRON_QUEUE_FAIL");
                });
            } else {
                shiprocketService.syncTrackingStatus().catch((err) => {
                    logger.error({ error: err.message }, "SHIPROCKET_TRACKING_CRON_FAIL");
                });
            }
        }, 30 * 60 * 1000).unref();

        // 5. Start listening
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                handleFatalError("EADDRINUSE", new Error(`Port ${PORT} already in use. Please kill previous process.`));
            } else {
                handleFatalError("SERVER_ERROR", err);
            }
        });

        server.listen(PORT, "0.0.0.0", async () => {
            console.log(chalk.green.bold(`\n✅ High-Scale Server Ready at http://localhost:${PORT}`));
            logger.info("SERVER READY");
            console.log(chalk.blue(`📡 Socket.io Ready at ws://localhost:${PORT}`));

            // 6. Pre-warm Cache (non-blocking) after DB+server become ready.
            setTimeout(async () => {
                try {
                    const { prewarmCache } = require("./services/prewarm.service");
                    await prewarmCache();
                } catch (err) {
                    logger.warn(`⚠️ [PREWARM_SKIPPED] ${err.message}`);
                }
            }, 1000);

            if (process.send) process.send("ready");
        });

        // MONITORING & FALLBACKS (Goal 5)
        const { startMonitoring } = require("./utils/monitor");
        startMonitoring();

        let handleShutdown = async (signal) => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            logger.info(`🚨 [SHUTDOWN] Received ${signal}. Starting graceful termination...`);

            server.close(async () => {
                logger.info("📡 [SHUTDOWN] HTTP server closed.");
                try {
                    await connectDB.close();
                    logger.info("[SHUTDOWN] MySQL connection closed.");

                    if (redisClient && redisClient.rawClient && redisClient.rawClient.status !== "end") {
                        await redisClient.rawClient.quit();
                        logger.info("🔴 [SHUTDOWN] Redis connection closed.");
                    }
                } catch (err) {
                    logger.error("⚠️ [SHUTDOWN_ERROR]", err);
                }
                logger.info("👋 [SHUTDOWN] Exit successful.");
                process.exit(0);
            });

            setTimeout(() => {
                logger.fatal("🔥 [SHUTDOWN] Forced shutdown due to timeout.");
                process.exit(1);
            }, 10000);
        };

        process.on("SIGTERM", () => handleShutdown("SIGTERM"));
        process.on("SIGINT", () => handleShutdown("SIGINT"));

    } catch (err) {
        handleFatalError("STARTUP_FATAL", err);
    }
};

if (require.main === module) {
    if (cluster.isPrimary) {
        lockManager.acquireLock();
        lockManager.setupCleanup();
    }

    if (cluster.isPrimary && env.NODE_ENV === "production" && !process.env.pm_id) {
        const numCPUs = os.cpus().length;
        for (let i = 0; i < numCPUs; i++) cluster.fork();
        cluster.on("exit", () => cluster.fork());
    } else {
        bootstrap().catch(err => {
            handleFatalError("BOOTSTRAP_PROMISE_FAIL", err);
        });
    }
}

module.exports = app;
