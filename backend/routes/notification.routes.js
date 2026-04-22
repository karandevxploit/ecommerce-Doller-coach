const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, authorize } = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.v2");
const { logger } = require("../utils/logger");

const {
  sendNotification,
  myNotifications,
  markAsRead,
  markAllAsRead,
  adminFeed,
} = require("../controllers/notification.controller");

/**
 * PARAM VALIDATION
 */
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid notification ID",
    });
  }
  next();
};

/**
 * SEND NOTIFICATION (ADMIN ONLY + RATE LIMITED)
 */
router.post(
  "/send",
  protect,
  authorize("admin"),
  authLimiter,
  safeHandler(async (req, res, next) => {
    try {
      const result = await sendNotification(req, res);

      if (!res.headersSent) {
        res.json({ success: true, data: result });
      }
    } catch (err) {
      logger.error("NOTIFICATION_SEND_FAILED", {
        adminId: req.user?.id,
        error: err.message,
      });
      next(err);
    }
  })
);

/**
 * USER NOTIFICATIONS (PAGINATED)
 */
router.get(
  "/my",
  protect,
  safeHandler(async (req, res, next) => {
    try {
      const result = await myNotifications(req, res);

      if (!res.headersSent) {
        res.json({ success: true, data: result });
      }
    } catch (err) {
      logger.error("NOTIFICATION_FETCH_FAILED", {
        userId: req.user?.id,
        error: err.message,
      });
      next(err);
    }
  })
);

/**
 * ADMIN FEED (PAGINATION REQUIRED IN CONTROLLER)
 */
router.get(
  "/admin-feed",
  protect,
  authorize("admin"),
  authLimiter,
  safeHandler(adminFeed)
);

/**
 * MARK ALL AS READ (RATE LIMITED)
 */
router.post(
  "/read/all",
  protect,
  authLimiter,
  safeHandler(async (req, res, next) => {
    try {
      const result = await markAllAsRead(req, res);

      if (!res.headersSent) {
        res.json({ success: true, data: result });
      }
    } catch (err) {
      logger.warn("NOTIFICATION_MARK_ALL_FAILED", {
        userId: req.user?.id,
        error: err.message,
      });
      next(err);
    }
  })
);

/**
 * MARK SINGLE AS READ (SAFE)
 */
router.post(
  "/read/:id",
  protect,
  authLimiter,
  validateObjectId,
  safeHandler(async (req, res, next) => {
    try {
      const result = await markAsRead(req, res);

      if (!res.headersSent) {
        res.json({ success: true, data: result });
      }
    } catch (err) {
      logger.warn("NOTIFICATION_MARK_FAILED", {
        userId: req.user?.id,
        notificationId: req.params.id,
        error: err.message,
      });
      next(err);
    }
  })
);

module.exports = router;