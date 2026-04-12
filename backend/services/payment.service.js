const Razorpay = require("razorpay");
const crypto = require("crypto");
const env = require("../config/env");
const orderRepository = require("../repositories/order.repository");
const logger = require("../utils/logger");

class PaymentService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  async createRazorpayOrder(orderId, amount) {
    const options = {
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: `order_rcpt_${orderId}`,
    };

    try {
      const rpOrder = await this.razorpay.orders.create(options);
      return rpOrder;
    } catch (err) {
      logger.error("Razorpay order creation failed:", err);
      throw err;
    }
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  safeCompare(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    return this.safeCompare(generatedSignature, razorpaySignature);
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      logger.warn("RAZORPAY_WEBHOOK_SECRET is not configured");
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    return this.safeCompare(expectedSignature, signature);
  }

  async handleWebhook(event) {
    const { payload, event: eventType } = event;
    const payment = payload.payment.entity;
    const orderId = payment.notes?.orderId || payment.order_id;

    logger.info(`Processing payment webhook: ${eventType} for order ${orderId}`);

    const dbOrder = await orderRepository.findByRazorpayOrderId(payment.order_id);
    if (!dbOrder) {
      logger.warn(`Order not found for Razorpay order ID ${payment.order_id}`);
      return;
    }

    // 1. Idempotency Check: Prevent duplicate processing of the same payment ID
    if (dbOrder.payment?.razorpayPaymentId === payment.id && dbOrder.paymentStatus === "PAID") {
      logger.info(`Webhook Idempotency: Payment ${payment.id} already processed for Order ${dbOrder._id}`);
      return;
    }

    if (eventType === "payment.captured") {
      // 2. CRITICAL SECURITY: Amount Verification
      // Razorpay amount is in paise (totalAmount * 100)
      const expectedAmount = Math.round(dbOrder.totalAmount * 100);
      const paidAmount = payment.amount;

      if (Math.abs(paidAmount - expectedAmount) > 0) {
        logger.error(`FRAUD ATTEMPT: Amount mismatch for order ${dbOrder._id}. Expected ${expectedAmount}, Paid ${paidAmount}. IP: ${payment.ip}`);
        
        await orderRepository.updatePaymentInfo(dbOrder._id, {
          paymentId: payment.id,
          status: "FAILED",
          signature: "FRAUD_ATTEMPT_AMOUNT_MISMATCH"
        });
        return;
      }

      await orderRepository.updatePaymentInfo(dbOrder._id, {
        paymentId: payment.id,
        signature: "WEBHOOK_VERIFIED",
        status: "PAID",
      });

      const orderService = require("./order.service");
      if (dbOrder.couponCode) {
        await orderService.finalizeCouponUsage(dbOrder.couponCode);
      }

      logger.info(`Payment CAPTURED and VERIFIED for order ${dbOrder._id}`);
    } else if (eventType === "payment.failed") {
      await orderRepository.updatePaymentInfo(dbOrder._id, {
        paymentId: payment.id,
        signature: "WEBHOOK_VERIFIED",
        status: "FAILED",
      });
      logger.warn(`Payment FAILED for order ${dbOrder._id}`);
    }
  }
}

module.exports = new PaymentService();
