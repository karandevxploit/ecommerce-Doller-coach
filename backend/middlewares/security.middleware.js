const AppError = require("../utils/AppError");
const { logger } = require("../utils/logger");
const { getRequestId } = require("./requestTracker"); // assuming previous upgrade

/**
 * ENTERPRISE PAYLOAD FIREWALL
 *
 * Features:
 * - Deep payload traversal (objects + arrays)
 * - Payload size limiting
 * - Optimized scanning (early exit)
 * - Stronger pattern detection
 * - Content-Type strict validation
 * - Structured logging with requestId
 * - Fail-safe (never crash)
 */

const PUBLIC_PATHS = new Set([
    "/api/auth/admin-login",
    "/api/auth/login",
    "/api/auth/register",
]);

const MAX_SCAN_SIZE = 10 * 1024; // 10KB max scan buffer

const maliciousPatterns = [
    /<script\b[^>]*>/i,
    /javascript\s*:/i,
    /UNION\s+SELECT/i,
    /\bSELECT\b.*\bFROM\b/i,
    /\$where\s*:/i,
    /\{\s*\$(gt|lt|ne|in|regex)\s*:/i,
    /\.\.\//,
];

// Strict content-type validation
const isValidContentType = (contentType = "") => {
    return (
        contentType === "application/json" ||
        contentType.startsWith("application/json;") ||
        contentType.startsWith("multipart/form-data")
    );
};

// Deep traversal with early exit
const extractStrings = (input, buffer = [], sizeTracker = { size: 0 }) => {
    if (!input || sizeTracker.size > MAX_SCAN_SIZE) return buffer;

    if (typeof input === "string") {
        sizeTracker.size += input.length;
        if (sizeTracker.size <= MAX_SCAN_SIZE) {
            buffer.push(input);
        }
        return buffer;
    }

    if (Array.isArray(input)) {
        for (const item of input) {
            extractStrings(item, buffer, sizeTracker);
            if (sizeTracker.size > MAX_SCAN_SIZE) break;
        }
        return buffer;
    }

    if (typeof input === "object") {
        for (const key in input) {
            extractStrings(input[key], buffer, sizeTracker);
            if (sizeTracker.size > MAX_SCAN_SIZE) break;
        }
    }

    return buffer;
};

exports.payloadFirewall = (req, res, next) => {
    const requestId = getRequestId?.() || "unknown";

    try {
        // Whitelist
        if (PUBLIC_PATHS.has(req.path) || PUBLIC_PATHS.has(req.originalUrl)) {
            return next();
        }

        if (req.originalUrl.startsWith("/api/upload")) {
            return next();
        }

        // Strict Content-Type
        if (["POST", "PUT", "PATCH"].includes(req.method)) {
            const contentType = req.headers["content-type"]?.toLowerCase() || "";

            if (!isValidContentType(contentType)) {
                logger.warn("[SECURITY] 415 Reject", {
                    requestId,
                    method: req.method,
                    path: req.originalUrl,
                    contentType,
                });

                return next(
                    new AppError(
                        "Invalid Content-Type. application/json or multipart/form-data required.",
                        415
                    )
                );
            }
        }

        // Extract payload safely
        const strings = extractStrings(req.body)
            .concat(extractStrings(req.query))
            .concat(extractStrings(req.params));

        let scannedSize = 0;

        for (const str of strings) {
            scannedSize += str.length;
            if (scannedSize > MAX_SCAN_SIZE) break;

            for (const pattern of maliciousPatterns) {
                if (pattern.test(str)) {
                    const clientIp =
                        req.ip ||
                        req.socket?.remoteAddress ||
                        "unknown";

                    logger.warn("[SECURITY INTERCEPTION]", {
                        requestId,
                        ip: clientIp,
                        path: req.originalUrl,
                        pattern: String(pattern),
                        sample: str.substring(0, 100),
                    });

                    return next(
                        new AppError(
                            "Access Denied: Malicious payload detected.",
                            403
                        )
                    );
                }
            }
        }
    } catch (err) {
        // Never block request due to firewall failure
        logger.error("[SECURITY] Firewall failure", {
            requestId,
            error: err.message,
        });
    }

    next();
};