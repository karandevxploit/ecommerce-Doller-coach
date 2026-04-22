const requestService = require("../services/request.service");
const env = require("../config/env");
const { fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");
const { redis } = require("../config/redis");

// ===============================
// CONFIG (per-action thresholds)
// ===============================
const DEFAULT_THRESHOLD = 0.5;
const ACTION_THRESHOLDS = {
  login: 0.7,
  register: 0.7,
  checkout: 0.6,
  contact: 0.4,
};

// fail-open only for low-risk actions
const FAIL_OPEN_ACTIONS = new Set(["contact"]);

// replay window (seconds)
const TOKEN_TTL = 120;

// ===============================
// HELPER
// ===============================
const getIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.socket?.remoteAddress ||
  req.ip ||
  "";

// ===============================
// FACTORY (allow per-route action)
// ===============================
exports.verifyRecaptcha = (expectedAction = "default") =>
  async (req, res, next) => {
    if (env.NODE_ENV !== "production") {
      return next();
    }
    console.log(`[RECAPTCHA] STEP 1: Starting verification for action: ${expectedAction}`);

    if (!env.RECAPTCHA_SECRET_KEY) {
      if (env.NODE_ENV === "production") {
        logger.error("[RECAPTCHA_CONFIG_MISSING]");
        return fail(res, "Security configuration error.", 500);
      }
      console.log("[RECAPTCHA] SKIP: Secret key missing in dev mode");
      return next();
    }

    const token = req.body?.recaptchaToken;
    if (!token) {
      console.warn("[RECAPTCHA] FAIL: Token missing in request body");
      return fail(res, "Security verification token missing.", 400);
    }

    // ===============================
    // REPLAY PROTECTION (Redis)
    // ===============================
    if (redis && redis.status === "ready") {
      try {
        const used = await Promise.race([
          redis.get(`rc:used:${token}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Redis Timeout")), 500))
        ]);
        if (used) {
          logger.warn("[RECAPTCHA_REPLAY]", { ip: getIp(req) });
          return fail(res, "Invalid security token.", 403);
        }
      } catch (err) {
        console.warn("[RECAPTCHA] Redis check timed out, proceeding...");
      }
    }

    try {
      console.log("[RECAPTCHA] STEP 2: Calling Google SiteVerify...");
      const response = await Promise.race([
        requestService.post(
          "https://www.google.com/recaptcha/api/siteverify",
          null,
          {
            params: {
              secret: env.RECAPTCHA_SECRET_KEY,
              response: token,
              remoteip: getIp(req),
            },
          }
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("verification_timeout")), 2500)
        ),
      ]);

      const data = response.data || {};
      const {
        success,
        score = 0,
        action,
        hostname,
      } = data;

      console.log(`[RECAPTCHA] STEP 3: API Response received. Success: ${success}, Score: ${score}`);

      // ===============================
      // VALIDATIONS
      // ===============================
      if (!success) {
        logger.warn("[RECAPTCHA_FAIL]", data);
        return fail(res, "Security verification failed.", 403);
      }

      // action binding
      if (expectedAction !== "default" && action !== expectedAction) {
        logger.warn("[RECAPTCHA_ACTION_MISMATCH]", {
          expected: expectedAction,
          actual: action,
        });
        return fail(res, "Security validation mismatch.", 403);
      }

      const threshold =
        ACTION_THRESHOLDS[expectedAction] || DEFAULT_THRESHOLD;

      if (score < threshold) {
        logger.warn("[RECAPTCHA_LOW_SCORE]", {
          score,
          action,
          ip: getIp(req),
        });
        return fail(res, "Security check failed.", 403);
      }

      // mark token as used
      if (redis && redis.status === "ready") {
        redis.set(`rc:used:${token}`, "1", "EX", TOKEN_TTL).catch(() => { });
      }

      console.log("[RECAPTCHA] STEP 4: Verification OK. Proceeding to controller.");
      next();
    } catch (err) {
      logger.error("[RECAPTCHA_ERROR]", err.message);

      // Fail-open for local development or transient network timeouts
      if (env.NODE_ENV !== "production" || FAIL_OPEN_ACTIONS.has(expectedAction)) {
        console.warn(`[RECAPTCHA] FAIL-OPEN: Proceeding despite error: ${err.message}`);
        return next();
      }

      return fail(res, "Security verification unavailable.", 503);
    }
  };