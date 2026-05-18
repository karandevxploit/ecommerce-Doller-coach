const router = require("express").Router();
const mongoose = require("mongoose");

const { safeHandler } = require("../middlewares/error.middleware");
const { protect, isAdmin } = require("../middlewares/auth.middleware");
const { logger } = require("../utils/logger");

const {
  createOrder,
  getOrders,
  getOrderById,
  getMyOrders,
  downloadInvoice,
  canUserReview,
  verifyPayment,
  confirmOrder,
  updateOrderStatus,
  updatePaymentStatus,
  exportOrders,
} = require("../controllers/order.controller");

const idempotency = require("../middlewares/idempotency.middleware");
const { apiLimiter } = require("../middlewares/rateLimiter.v2");
const validate = require("../middlewares/validate.middleware");
const { createOrderSchema } = require("../validations/order.validation");

/**
 * PARAM VALIDATION
 */
const validateObjectId = (req, res, next) => {
  const { id, productId } = req.params;

  if (
    (id && !mongoose.Types.ObjectId.isValid(id)) ||
    (productId && !mongoose.Types.ObjectId.isValid(productId))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID",
    });
  }

  next();
};

/**
 * CREATE ORDER (IDEMPOTENT + RATE LIMITED)
 */
router.post(
  "/",
  protect,
  apiLimiter,
  idempotency,
  validate(createOrderSchema, "body"),
  safeHandler(async (req, res, next) => {
    try {
      logger.info("ORDER_CREATE_REQUEST", {
        userId: req.user?.id || req.user?._id,
        hasIdempotencyKey: Boolean(req.headers["x-idempotency-key"]),
        itemCount: Array.isArray(req.body?.products) ? req.body.products.length : 0,
      });
      
      const result = await createOrder(req, res);

      if (!res.headersSent) {
        res.json({ success: true, data: result });
      }
    } catch (err) {
      logger.error("ORDER_CREATE_FAILED", {
        userId: req.user?.id,
        error: err.message,
      });
      next(err);
    }
  })
);

/**
 * USER ORDERS (PAGINATED)
 */
router.get(
  "/my",
  protect,
  apiLimiter,
  safeHandler(getMyOrders)
);

/**
 * ADMIN ORDERS
 */
router.get(
  "/",
  protect,
  isAdmin,
  apiLimiter,
  safeHandler(getOrders)
);

router.put(
  "/:id/status",
  protect,
  isAdmin,
  apiLimiter,
  validateObjectId,
  safeHandler(updateOrderStatus)
);

router.post(
  "/:id/confirm",
  protect,
  isAdmin,
  apiLimiter,
  validateObjectId,
  safeHandler(confirmOrder)
);

router.put(
  "/:id/payment-status",
  protect,
  isAdmin,
  apiLimiter,
  validateObjectId,
  safeHandler(updatePaymentStatus)
);

router.post(
  "/verify-payment",
  protect,
  apiLimiter,
  idempotency,
  safeHandler(verifyPayment)
);

router.get(
  "/admin/export",
  protect,
  isAdmin,
  apiLimiter,
  safeHandler(exportOrders)
);

/**
 * CHECK REVIEW ELIGIBILITY
 */
router.get(
  "/check-review/:productId",
  protect,
  apiLimiter,
  validateObjectId,
  safeHandler(canUserReview)
);

/**
 * DOWNLOAD INVOICE (MERGED ROUTE)
 */
router.get(
  "/:id/invoice",
  protect,
  apiLimiter,
  validateObjectId,
  safeHandler(async (req, res, next) => {
    try {
      await downloadInvoice(req, res);

      logger.info("INVOICE_DOWNLOAD", {
        userId: req.user?.id,
        orderId: req.params.id,
      });
    } catch (err) {
      logger.error("INVOICE_DOWNLOAD_FAILED", {
        userId: req.user?.id,
        orderId: req.params.id,
        error: err.message,
      });
      next(err);
    }
  })
);

/**
 * GET SINGLE ORDER (SAFE)
 */
router.get(
  "/:id",
  protect,
  apiLimiter,
  validateObjectId,
  safeHandler(getOrderById)
);

module.exports = router;
