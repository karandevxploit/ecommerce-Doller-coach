const router = require("express").Router();
const { protect, authorize, requireAdmin } = require("../middlewares/auth.middleware");
const {
  createOrder,
  getOrders,
  getOrderById,
  getMyOrders,
  downloadInvoice,
  canUserReview
} = require("../controllers/order.controller");

router.post("/", protect, createOrder);
router.get("/my", protect, getMyOrders);
router.post("/checkout", protect, createOrder);
router.get("/", protect, getOrders);
router.get("/check-review/:productId", protect, canUserReview);
router.get("/:id/invoice", protect, downloadInvoice);
router.get("/:id/download-invoice", protect, downloadInvoice);
router.get("/:id", protect, getOrderById);
// Status updates moved to admin routes for security and consistency
// router.put("/:id/status", protect, authorize("admin"), updateOrderStatus);

module.exports = router;
