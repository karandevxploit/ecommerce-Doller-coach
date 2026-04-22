const { logger } = require("../utils/logger");
const crypto = require("crypto");

// ===============================
// CONFIG
// ===============================
const SLOW_REQUEST_THRESHOLD = 1000; // 1s
const SKIP_PATHS = ["/health", "/favicon.ico"];

// ===============================
// HELPER: GET REAL IP (PROXY SAFE)
// ===============================
const getIp = (req) => {
    return (
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket?.remoteAddress ||
        req.ip ||
        "unknown"
    );
};

// ===============================
// MIDDLEWARE
// ===============================
exports.analyticsLogger = (req, res, next) => {
    const start = Date.now();

    // Skip noisy endpoints
    if (SKIP_PATHS.includes(req.originalUrl)) {
        return next();
    }

    // Unique Request ID
    const requestId =
        req.headers["x-request-id"] || crypto.randomUUID();

    req.requestId = requestId;

    const { method, originalUrl } = req;
    const ip = getIp(req);
    const userId = req.user?._id || req.user?.id || null;

    res.on("finish", () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        // STRUCTURED LOG OBJECT
        const logData = {
            requestId,
            method,
            url: originalUrl.slice(0, 200), // prevent log overflow
            status,
            duration,
            ip,
            userId,
            userAgent: req.headers["user-agent"],
            timestamp: new Date().toISOString(),
        };

        // ERROR LOG
        if (status >= 500) {
            logger.error("[ANALYTICS_ERROR]", logData);
        } else if (status >= 400) {
            logger.warn("[ANALYTICS_WARN]", logData);
        } else {
            logger.info("[ANALYTICS]", logData);
        }

        // SLOW REQUEST ALERT
        if (duration > SLOW_REQUEST_THRESHOLD) {
            logger.warn("[SLOW_REQUEST]", logData);
        }
    });

    next();
};