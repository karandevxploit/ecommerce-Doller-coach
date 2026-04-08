const router = require("express").Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const {
  sendNotification,
  myNotifications,
  markAsRead,
  markAllAsRead,
  adminFeed,
} = require("../controllers/notification.controller");

router.post("/send", protect, authorize("admin"), sendNotification);
router.get("/my", protect, myNotifications);
router.get("/admin-feed", protect, authorize("admin"), adminFeed);
router.post("/read/all", protect, markAllAsRead);
router.post("/read/:id", protect, markAsRead);

module.exports = router;

