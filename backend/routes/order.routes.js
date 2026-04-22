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