const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const { protect, requireAdmin } = require("../middlewares/auth.middleware");

// Public
router.get("/:productId", reviewController.getReviewsByProduct);

// User
router.post("/", protect, reviewController.addReview);

// Admin
router.get("/admin/list", requireAdmin, reviewController.adminListReviews);
router.put("/admin/:id/approve", requireAdmin, reviewController.approveReview);
router.delete("/admin/:id", requireAdmin, reviewController.deleteReview);

module.exports = router;
