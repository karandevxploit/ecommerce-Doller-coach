const mongoose = require("mongoose");
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
      return await this.model
        .findOne({ "payment.razorpayOrderId": razorpayOrderId })
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
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new Error("Invalid orderId");
      }

      const { paymentId, signature, status } = paymentData;

      /**
       * STRONG FILTER:
       * - Prevent duplicate paymentId usage
       * - Prevent already processed orders
       */
      const query = {
        _id: orderId,
        paymentStatus: { $ne: "PAID" },
        "payment.razorpayPaymentId": null, // ensures idempotency
      };

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
          "payment.razorpayPaymentId": paymentId,
          "payment.razorpaySignature": signature,
          paymentStatus: status,
          status: orderStatus,
          isPaid,
          paidAt,
        },
      };

      const updated = await this.model.findOneAndUpdate(
        query,
        update,
        {
          ...options,
          new: true,
        }
      );

      if (!updated) {
        logger.warn("PAYMENT_IDEMPOTENT_SKIP", {
          requestId,
          orderId,
          paymentId,
        });

        return null; // already processed
      }

      return updated.toObject();
    } catch (err) {
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