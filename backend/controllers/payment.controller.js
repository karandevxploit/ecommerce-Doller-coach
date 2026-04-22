const PaymentService = require("../services/payment.service");
const orderRepository = require("../repositories/order.repository");
const Order = require("../models/order.model");

const mongoose = require("mongoose");
const crypto = require("crypto");

const { ok, fail } = require("../utils/apiResponse");
const { trackSignatureFailure } = require("../middlewares/fraud.middleware");
const asyncHandler = require("express-async-handler");
const { logger } = require("../utils/logger");
const env = require("../config/env");

// ===============================
// CREATE PAYMENT ORDER
// ===============================
exports.createPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return fail(res, "orderId required", 400);

  const order = await orderRepository.findById(orderId);
  if (!order) return fail(res, "Order not found", 404);

  if (req.user.role !== "admin" && String(order.userId) !== String(req.user._id)) {
    return fail(res, "Forbidden", 403);
  }

  if (order.paymentStatus === "PAID") {
    return fail(res, "Already paid", 409);
  }

  // Idempotent: don't recreate if exists
  if (order.payment?.razorpayOrderId) {
    return ok(res, {
      order: { id: order.payment.razorpayOrderId },
      keyId: env.RAZORPAY_KEY_ID,
      orderId: String(order._id),
    }, "Existing Razorpay order reused");
  }

  const rpOrder = await PaymentService.createRazorpayOrder(
    order._id,
    order.totalAmount
  );

  order.payment = {
    ...order.payment,
    razorpayOrderId: rpOrder.id,
  };

  await order.save();

  return ok(res, {
    order: rpOrder,
    keyId: env.RAZORPAY_KEY_ID,
    orderId: String(order._id),
  });
});

// ===============================
// VERIFY PAYMENT (CRITICAL)
// ===============================
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !orderId) {
    return fail(res, "Missing fields", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);

    if (!order) {
      await session.abortTransaction();
      return fail(res, "Order not found", 404);
    }

    if (req.user.role !== "admin" && String(order.userId) !== String(req.user._id)) {
      await session.abortTransaction();
      return fail(res, "Forbidden", 403);
    }

    // Idempotency check
    if (order.paymentStatus === "PAID") {
      await session.abortTransaction();
      return ok(res, { verified: true, order }, "Already paid");
    }

    // Verify signature
    const isValid = PaymentService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      await trackSignatureFailure(req.user._id);
      await session.abortTransaction();
      return fail(res, "Invalid signature", 400);
    }

    // FINAL ATOMIC UPDATE
    order.paymentStatus = "PAID";
    order.isPaid = true;
    order.paidAt = new Date();
    order.payment = {
      ...order.payment,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    };

    await order.save({ session });

    // Coupon finalize (atomic-safe)
    if (order.couponCode) {
      await require("../models/coupon.model").updateOne(
        {
          code: order.couponCode,
          $expr: { $lt: ["$usedCount", "$usageLimit"] }
        },
        { $inc: { usedCount: 1 } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(`PAYMENT VERIFIED: ${orderId}`);

    return ok(res, { verified: true, order });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    logger.error("VERIFY PAYMENT ERROR", err);
    return fail(res, "Payment verification failed", 500);
  }
});

// ===============================
// WEBHOOK HANDLER (CRITICAL)
// ===============================
exports.handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!PaymentService.verifyWebhookSignature(req.rawBody, signature)) {
    logger.error("WEBHOOK SIGNATURE INVALID");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body;

  // Only handle payment captured
  if (event.event !== "payment.captured") {
    return res.status(200).send("Ignored");
  }

  const payment = event.payload.payment.entity;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({
      "payment.razorpayOrderId": payment.order_id,
    }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(200).send("Order not found");
    }

    // Idempotency
    if (order.paymentStatus === "PAID") {
      await session.abortTransaction();
      return res.status(200).send("Already processed");
    }

    order.paymentStatus = "PAID";
    order.isPaid = true;
    order.paidAt = new Date();
    order.payment.razorpayPaymentId = payment.id;

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`WEBHOOK PAYMENT SUCCESS: ${order._id}`);

    return res.status(200).send("OK");

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    logger.error("WEBHOOK ERROR", err);
    return res.status(500).send("Error");
  }
});