const router = require("express").Router();
const { safeHandler } = require("../middlewares/error.middleware");
const { requireAdmin } = require("../middlewares/auth.middleware");
const { logger } = require("../utils/logger");
const mongoose = require("mongoose");

const {
    stats,
    listUsers,
    getRevenue,
    getOrderStats,
    getCustomerStats,
    getRevenueTrend,
    getOrderTrend,
    verifyPaymentExternal,
    uploadInvoiceTemplate,
} = require("../controllers/admin.controller");

const productController = require("../controllers/product.controller");
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
router.get("/stats", safeHandler(stats));
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
 * NOTIFICATIONS
 */
router.get("/notifications", safeHandler(notificationController.adminFeed));

/**
 * PAYMENT VERIFICATION (IDEMPOTENT REQUIRED)
 */
router.put("/pay", safeHandler(verifyPaymentExternal));

/**
 * PRODUCT MANAGEMENT
 */
router.get("/products", safeHandler(productController.listProducts));
router.post("/products", safeHandler(productController.createProduct));
router.put("/products/:id", validateObjectId, safeHandler(productController.updateProduct));
router.delete("/products/:id", validateObjectId, safeHandler(productController.deleteProduct));

/**
 * ORDER MANAGEMENT
 */
router.get("/orders/export", safeHandler(orderController.exportOrders)); // consider streaming
router.get("/orders", safeHandler(orderController.getOrders));
router.put("/orders/:id/status", validateObjectId, safeHandler(orderController.updateOrderStatus));
router.put("/orders/:id/pay", validateObjectId, safeHandler(orderController.updatePaymentStatus));

/**
 * OFFER MANAGEMENT
 */
router.get("/offers", safeHandler(offerController.listOffers));
router.post("/offers", safeHandler(offerController.createOffer));
router.put("/offers/:id", validateObjectId, safeHandler(offerController.updateOffer));
router.delete("/offers/:id", validateObjectId, safeHandler(offerController.deleteOffer));

/**
 * SECURE FILE UPLOAD (DOCX ONLY)
 */
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "../assets/tmp");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only .docx templates are allowed"));
        }
    },
});

router.post(
    "/invoice-template",
    upload.single("template"),
    safeHandler(async (req, res) => {
        try {
            await uploadInvoiceTemplate(req, res);

            // Cleanup temp file
            if (req.file?.path) {
                fs.unlink(req.file.path, () => { });
            }
        } catch (err) {
            logger.error("INVOICE_TEMPLATE_UPLOAD_FAILED", {
                error: err.message,
            });
            throw err;
        }
    })
);

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