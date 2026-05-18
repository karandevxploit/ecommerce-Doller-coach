const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");
const mongoose = require("mongoose");

const {
    getDashboardStats,
    listUsers,
    getRevenue,
    getOrderStats,
    getCustomerStats,
    getRevenueTrend,
    getOrderTrend,
    verifyPaymentExternal,
    getOrders,
    getOffers,
    getShipments
} = require("../controllers/admin.controller");

const productController = require("../controllers/product.controller");
const categoryController = require("../controllers/category.controller");
const orderController = require("../controllers/order.controller");
const offerController = require("../controllers/offer.controller");
const notificationController = require("../controllers/notification.controller");
const configController = require("../controllers/config.controller");
const { getSiteContent, updateSiteContent } = require("../controllers/siteContent.controller");

/**
 * GLOBAL ADMIN PROTECTION
 */
router.use(requireAdmin);

/**
 * BASIC PARAM VALIDATION MIDDLEWARE
 */
const validateObjectId = (req, res, next) => {
    const { id } = req.params;
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    next();
};

/**
 * ADMIN ANALYTICS (Heavy → should be cached at service layer)
 */
router.get(["/dashboard", "/stats", "/overview", "/dashboard-summary"], safeHandler(getDashboardStats));
router.get("/revenue", safeHandler(getRevenue));
router.get("/revenue/trend", safeHandler(getRevenueTrend));
router.get("/orders/stats", safeHandler(getOrderStats));
router.get("/orders/trend", safeHandler(getOrderTrend));
router.get("/customers/stats", safeHandler(getCustomerStats));

/**
 * USER MANAGEMENT
 */
router.get("/users", safeHandler(listUsers));

/**
 * ADMIN: INVENTORY & SALES
 */
router.get("/orders", safeHandler(getOrders));
router.get("/orders/:id", validateObjectId, safeHandler(orderController.getOrderById));
router.post("/orders/:id/confirm", validateObjectId, safeHandler(orderController.confirmOrder));
router.put("/orders/:id/status", validateObjectId, safeHandler(orderController.updateOrderStatus));
router.put("/orders/:id/payment", validateObjectId, safeHandler(orderController.updatePaymentStatus));
router.put("/orders/:id/payment-status", validateObjectId, safeHandler(orderController.updatePaymentStatus));
router.get("/orders/:id/invoice", validateObjectId, safeHandler(orderController.downloadInvoice));
router.get("/offers", safeHandler(getOffers));
router.post("/offers", validateObjectId, safeHandler(offerController.createOffer));
router.put("/offers/:id", validateObjectId, safeHandler(offerController.updateOffer));
router.delete("/offers/:id", validateObjectId, safeHandler(offerController.deleteOffer));
router.get("/shipments", safeHandler(getShipments));
router.get("/products", safeHandler(productController.adminListProducts));
router.post("/products", safeHandler(productController.createProduct));
router.put("/products/:id", validateObjectId, safeHandler(productController.updateProduct));
router.patch("/products/:id/status", validateObjectId, safeHandler(productController.toggleProductStatus));
router.delete("/products/:id/video", validateObjectId, safeHandler(productController.deleteVideo));
router.delete("/products/:id", validateObjectId, safeHandler(productController.deleteProduct));
router.get("/categories", safeHandler(categoryController.listCategories));
router.post("/categories", safeHandler(categoryController.createCategory));
router.put("/categories/:id", validateObjectId, safeHandler(categoryController.updateCategory));
router.delete("/categories/:id", validateObjectId, safeHandler(categoryController.deleteCategory));

/**
 * NOTIFICATIONS
 */
router.get("/notifications", safeHandler(notificationController.adminFeed));

/**
 * PAYMENT VERIFICATION (IDEMPOTENT REQUIRED)
 */
router.put("/pay", safeHandler(verifyPaymentExternal));

/**
 * CONFIG MANAGEMENT
 */
router.put("/config", safeHandler(configController.updateConfig));

/**
 * SITE CONTENT MANAGEMENT
 */
router.get("/site-content", safeHandler(getSiteContent));
router.put("/site-content", safeHandler(updateSiteContent));

module.exports = router;
