const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const { requireAdmin } = require("../middlewares/auth.middleware");
const { stats, listUsers, getRevenue, getOrderStats, getCustomerStats, getRevenueTrend, getOrderTrend } = require("../controllers/admin.controller");
const productController = require("../controllers/product.controller");
const orderController = require("../controllers/order.controller");
const offerController = require("../controllers/offer.controller");
const notificationController = require("../controllers/notification.controller");
const configController = require("../controllers/config.controller");
const { getPerformanceMetrics } = require("../controllers/performance.controller");
const { upload: multerMemory } = require("../middlewares/upload.middleware");

// Auth + Authorization Middleware for all sub-routes
router.use(requireAdmin);

router.get("/stats", stats);
router.get("/revenue", getRevenue);
router.get("/revenue/trend", getRevenueTrend);
router.get("/orders/stats", getOrderStats);
router.get("/orders/trend", getOrderTrend);
router.get("/customers/stats", getCustomerStats);
router.get("/users", listUsers);
router.get("/notifications", notificationController.adminFeed);
router.get("/performance", getPerformanceMetrics);
router.put("/pay", requireAdmin, require("../controllers/admin.controller").verifyPaymentExternal);

// Unified Admin Product Management
router.get("/products", productController.listProducts);
router.post("/products", productController.createProduct);
router.put("/products/:id", productController.updateProduct);
router.delete("/products/:id", productController.deleteProduct);

// --- ORDER MANAGEMENT ---
router.get("/orders/export", orderController.exportOrders);
router.get("/orders", orderController.getOrders);
router.put("/orders/:id/status", requireAdmin, orderController.updateOrderStatus);
router.put("/orders/:id/pay", requireAdmin, orderController.updatePaymentStatus);

// Unified Admin Offer Management
router.get("/offers", offerController.listOffers);
router.post("/offers", offerController.createOffer);
router.put("/offers/:id", offerController.updateOffer);
router.delete("/offers/:id", offerController.deleteOffer);

// Unified Admin Invoice Template Management (Phase 2)
const multer = require("multer");
const upload = multer({
    dest: "assets/tmp/",
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            cb(null, true);
        } else {
            cb(new Error("Only .docx templates are allowed"));
        }
    }
});

router.post("/invoice-template", upload.single("template"), asyncHandler(async (req, res) => {
    const { uploadInvoiceTemplate } = require("../controllers/admin.controller");
    await uploadInvoiceTemplate(req, res);
}));

// Dynamic Logo & Company Config (Phase 2)
router.post("/logo", multerMemory.single("logo"), configController.uploadLogo);
router.put("/config", configController.updateConfig);

module.exports = router;

