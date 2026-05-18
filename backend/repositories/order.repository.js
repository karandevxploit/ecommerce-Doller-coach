const BaseRepository = require("./base.repository");
const Order = require("../models/order.model");
const { logger } = require("../utils/logger");
const { getRequestId } = require("../middlewares/requestTracker");

/**
 * ENTERPRISE ORDER REPOSITORY
 *
 * Features:
 * - Strong idempotency
 * - Replay protection
 * - Safe status transitions
 * - Logging + observability
 */

const clean = (value = "") => String(value || "").trim();
const PAYMENT_STATUS = new Set(["PENDING", "PAID", "FAILED"]);

const normalizePaymentStatus = (status = "PENDING") => {
  const normalized = clean(status).toUpperCase();
  return PAYMENT_STATUS.has(normalized) ? normalized : "PENDING";
};

class OrderRepository extends BaseRepository {
  constructor() {
    super(Order);
  }

  /**
   * FIND BY RAZORPAY ORDER ID (SAFE)
   */
  async findByRazorpayOrderId(razorpayOrderId) {
    const requestId = getRequestId?.();

    try {
      const safeRazorpayOrderId = clean(razorpayOrderId);
      if (!safeRazorpayOrderId) return null;

      return await this.model
        .findOne({
          "payment.razorpayOrderId": safeRazorpayOrderId,
        })
        .lean();
    } catch (err) {
      logger.error("ORDER_FETCH_RAZORPAY_FAILED", {
        requestId,
        razorpayOrderId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * ATOMIC PAYMENT UPDATE (IDEMPOTENT + SAFE)
   */
  async updatePaymentInfo(orderId, paymentData, options = {}) {
    const requestId = getRequestId?.();

    try {
      const safeOrderId = this.toObjectId(orderId);
      if (!safeOrderId) {
        throw new Error("Invalid orderId");
      }

      const paymentId = clean(paymentData?.paymentId || paymentData?.razorpayPaymentId);
      const signature = clean(paymentData?.signature || paymentData?.razorpaySignature);
      const razorpayOrderId = clean(paymentData?.razorpayOrderId);
      const status = normalizePaymentStatus(paymentData?.status);

      if (status === "PAID" && !paymentId) {
        throw new Error("paymentId is required for paid orders");
      }

      /**
       * STRONG FILTER:
       * - Prevent duplicate paymentId usage
       * - Prevent already processed orders
       */
      const query = {
        _id: safeOrderId,
        paymentStatus: { $ne: "PAID" },
      };

      if (status === "PAID") {
        query.$or = [
          { "payment.razorpayPaymentId": { $in: [null, ""] } },
          { "payment.razorpayPaymentId": paymentId },
        ];
      }

      /**
       * SAFE STATUS MAPPING
       */
      let orderStatus = "placed";
      let isPaid = false;
      let paidAt = null;

      if (status === "PAID") {
        orderStatus = "confirmed";
        isPaid = true;
        paidAt = new Date();
      } else if (status === "FAILED") {
        orderStatus = "cancelled";
      }

      const update = {
        $set: {
          paymentStatus: status,
          status: orderStatus,
          isPaid,
          paidAt,
        },
      };

      if (razorpayOrderId) {
        update.$set["payment.razorpayOrderId"] = razorpayOrderId;
      }

      if (signature) {
        update.$set["payment.razorpaySignature"] = signature;
      }

      if (status === "PAID") {
        update.$set["payment.razorpayPaymentId"] = paymentId;
        update.$set.isLocked = true;
      }

      const updated = await this.model.findOneAndUpdate(
        query,
        update,
        {
          ...options,
          new: true,
          runValidators: true,
          context: "query",
        }
      );

      if (!updated) {
        const existing = paymentId
          ? await this.model
              .findOne({ _id: safeOrderId, "payment.razorpayPaymentId": paymentId })
              .lean()
          : null;

        if (existing?.paymentStatus === "PAID") {
          return existing;
        }

        logger.warn("PAYMENT_IDEMPOTENT_SKIP", {
          requestId,
          orderId: String(safeOrderId),
          paymentId,
        });

        return null; // already processed
      }

      return typeof updated.toObject === "function" ? updated.toObject() : updated;
    } catch (err) {
      if (err?.code === 11000) {
        logger.warn("PAYMENT_DUPLICATE_ID_BLOCKED", {
          requestId,
          orderId: String(orderId),
          paymentId: clean(paymentData?.paymentId || paymentData?.razorpayPaymentId),
        });
        return null;
      }

      logger.error("ORDER_PAYMENT_UPDATE_FAILED", {
        requestId,
        orderId,
        error: err.message,
      });
      throw err;
    }
  }
}

module.exports = new OrderRepository();
