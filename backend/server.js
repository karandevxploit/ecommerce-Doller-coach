// --- GLOBAL EXCEPTION SAFETY (Goal 3) ---
process.on("uncaughtException", (err) => {
    console.error("≡ƒÆÑ UNCAUGHT_EXCEPTION:", err.message);
    if (process.env.NODE_ENV === "production") process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.error("≡ƒÜ½ UNHANDLED_REJECTION:", err);
});

// 1. INITIALIZE ENVIRONMENT
require("dotenv").config();
const path = require("path");

const { validateStartup } = require("./utils/internal/startup-validation");
validateStartup();

const cluster = require("cluster");
const os = require("os");
const lockManager = require("./utils/internal/lock-manager");

if (cluster.isPrimary) {
  lockManager.acquireLock();
  lockManager.setupCleanup();
}

const { logger, chalk } = require("./utils/logger");
const env = require("./config/env");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const http = require("http");
const redisClient = require("./config/redis"); 
const realtimeService = require("./services/realtime.service");
const { initializeAllQueues } = require("./services/queue.service");
const { verifyCloudinary } = require("./config/cloudinary");

const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const xss = require("xss-clean");

let isShuttingDown = false;

/**
 * PRODUCTION-GRADE CRASH SAFETY
 */
const handleFatalError = (type, err) => {
    if (isShuttingDown) return;
    logger.fatal(`💥 ${type}:`, { message: err.message, stack: err.stack });
    try {
        const fs = require('fs');
        fs.appendFileSync('FATAL_CRASH.log', `\n[${new Date().toISOString()}] ${type}: ${err.message}\n${err.stack}\n`);
    } catch(e) {}
    
    // Graceful exit attempt
    if (type === "UNCAUGHT_EXCEPTION" || type === "STARTUP_FATAL" || type === "EADDRINUSE") {
        setTimeout(() => process.exit(1), 2000);
    }
};

process.on("uncaughtException", (err) => handleFatalError("UNCAUGHT_EXCEPTION", err));
process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    handleFatalError("UNHANDLED_REJECTION", err);
});

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// --- 0. STABILIZATION & LOAD CONTROL (EMERGENCY LAYER) ---
const { requestIdMiddleware: requestId } = require("./middlewares/requestId.middleware");
const { timeoutMiddleware, loadShedder, requestCounter } = require("./middlewares/loadControl.middleware");

app.use(requestCounter);       // 1. Precise active request tracking
app.use(requestId);            // 2. Traceability
app.use(require("./middlewares/metrics.middleware")); // 3. Performance Metrics
app.use(timeoutMiddleware(5000)); // 4. 5s Global cutoff for performance
app.use(loadShedder);          // 5. Proactive Shedding

const { dedup } = require("./middlewares/dedup.middleware");
app.use(dedup(1));             // 6. Request Deduplication (1s window)

// 🩺 LIGHTWEIGHT HEALTH MONITOR (PRE-MIDDLEWARE)
app.get("/health", (req, res) => res.status(200).json({ status: "OK", uptime: process.uptime() }));

// --- 1. CORE SECURITY & PERFORMANCE LAYER ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
})); 
app.use(cookieParser());

// 🛡️ ENTERPRISE-GRADE CORS CONFIGURATION
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            "http://localhost:3000", 
            "http://127.0.0.1:3000", 
            "https://dollercoach.com",
            process.env.CLIENT_URL
        ].filter(Boolean);
        
        const isLocal = origin?.startsWith("http://localhost") || origin?.startsWith("http://127.0.0.1");

        if (!origin || isLocal || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS_REJECTED] Origin: ${origin}`);
            callback(new Error("CORS Policy Violation"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    maxAge: 86400, // Cache preflight for 24h
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Explicitly handle preflight for all routes

// 💓 API HEARTBEAT (Fixes 404 on /api)
app.get("/api", (req, res) => res.json({ 
    success: true, 
    message: "Doller Coach API is alive", 
    timestamp: new Date(),
    env: process.env.NODE_ENV
}));

app.use(compression());

// STANDARD BODY PARSERS - Optimized for high throughput
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Protection against common exploits
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss());           // Prevent XSS

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
app.use(express.static(path.join(__dirname, "assets")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- 2. RATE LIMITING (ROUTE-SPECIFIC) ---
const { authLimiter, apiLimiter, dashboardLimiter, uploadLimiter } = require("./middlewares/rateLimiter.v2");

// --- 3. FULL ROUTE MAPPING (UNIFIED TREE) ---
app.use("/api/auth", authLimiter, require("./routes/auth.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/orders", apiLimiter, require("./routes/order.routes"));
app.use("/api/payments", apiLimiter, require("./routes/payment.routes"));
app.use("/api/carts", require("./routes/cart.routes"));
app.use("/api/wishlists", require("./routes/wishlist.routes"));
app.use("/api/reviews", require("./routes/review.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/coupons", require("./routes/coupon.routes"));
app.use("/api/offers", require("./routes/offer.routes"));
app.use("/api/config", require("./routes/config.routes"));
app.use("/api/delivery", apiLimiter, require("./routes/delivery.routes"));

const adminRoutes = require("./routes/admin.routes");
app.use("/api/admin", dashboardLimiter, adminRoutes);
app.use("/api/dashboard", dashboardLimiter, adminRoutes);
app.use("/api/site-content", require("./routes/siteContent.routes"));

app.use("/api/webhooks/shiprocket", require("./routes/shiprocket.routes"));
app.use("/api/shiprocket", require("./routes/shiprocket.routes"));

app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Welcome to Doller Coach API",
    version: "1.0.0",
    status: "Healthy"
  });
});

app.use("/api/uploads", uploadLimiter, require("./routes/upload.routes"));

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middlewares/error.middleware");
app.use(notFound);
app.use(errorHandler);

let serverStarted = false;

const bootstrap = async () => {
    if (serverStarted) return;
    serverStarted = true;
    
    const PORT = process.env.PORT || 8001;
    const server = http.createServer(app);

    try {
        // 1. Database first
        await connectDB();
        
        // 2. Redis Second
        if (env.REDIS_ENABLED) {
            await redisClient.waitForReady();
        }

        // 3. Third-party services
        await verifyCloudinary();
        await realtimeService.initialize(server);
        
        // 4. Queues last
        if (env.REDIS_ENABLED) {
            await initializeAllQueues();
        }

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
            console.log(chalk.blue(`📡 Socket.io Ready at ws://localhost:${PORT}`));
            
            // 6. Pre-warm Cache (Non-blocking, 1s delay)
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
                   await mongoose.connection.close(false);
                   logger.info("📦 [SHUTDOWN] MongoDB connection closed.");

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

if (cluster.isPrimary && env.NODE_ENV === "production" && !process.env.pm_id) {
    const numCPUs = os.cpus().length;
    for (let i = 0; i < numCPUs; i++) cluster.fork();
    cluster.on("exit", () => cluster.fork());
} else {
    bootstrap().catch(err => {
        handleFatalError("BOOTSTRAP_PROMISE_FAIL", err);
    });
}

module.exports = app;
