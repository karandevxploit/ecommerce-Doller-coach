const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const PaymentService = require("../services/payment.service");
const Order = require("../models/order.model");
const orderStackService = require("../services/order.service");
const { ok, fail } = require("../utils/apiResponse");
const { trackSignatureFailure } = require("../middlewares/fraud.middleware");
const { logger } = require("../utils/logger");
const env = require("../config/env");

const MAX_PAYMENT_AMOUNT = 10_000_000;

const clean = (value = "") => String(value ?? "").trim();
const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const getUserId = (req) => req.user?._id || req.user?.id;

const canAccessOrder = (req, order) => {
  if (!order || !req.user) return false;
  return req.user.role === "admin" || String(order.userId) === String(getUserId(req));
};

const normalizeVerifyBody = (body = {}) => ({
  orderId: clean(body.orderId || body.id),
  razorpayOrderId: clean(body.razorpayOrderId || body.razorpay_order_id),
  razorpayPaymentId: clean(body.razorpayPaymentId || body.razorpay_payment_id),
  razorpaySignature: clean(body.razorpaySignature || body.razorpay_signature),
});

const markOrderPaid = async ({ order, razorpayOrderId, razorpayPaymentId, razorpaySignature, session = null }) => {
  if (order.paymentStatus === "PAID") return order;

  order.paymentStatus = "PAID";
  order.status = order.status === "placed" ? "confirmed" : order.status;
  order.isPaid = true;
  order.paidAt = new Date();
  order.payment = {
    ...(order.payment || {}),
    razorpayOrderId: razorpayOrderId || order.payment?.razorpayOrderId || null,
    razorpayPaymentId: razorpayPaymentId || order.payment?.razorpayPaymentId || null,
    razorpaySignature: razorpaySignature || order.payment?.razorpaySignature || null,
  };

  await order.save(session ? { session } : undefined);
  return order;
};

exports.createPaymentOrder = asyncHandler(async (req, res) => {
  const orderId = clean(req.body?.orderId);
  const amount = safeNumber(req.body?.amount, 0);

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return fail(res, "Payment gateway is not configured", 503);
  }

  let dbOrder = null;
  let payableAmount = amount;

  if (orderId) {
    if (!isObjectId(orderId)) return fail(res, "Invalid orderId", 400);

    dbOrder = await Order.findById(orderId);
    if (!dbOrder) return fail(res, "Order not found", 404);
    if (!canAccessOrder(req, dbOrder)) return fail(res, "Forbidden", 403);
    if (dbOrder.paymentStatus === "PAID") return fail(res, "Already paid", 409);

    payableAmount = safeNumber(dbOrder.total, 0);

    if (dbOrder.payment?.razorpayOrderId) {
      return ok(res, {
        id: dbOrder.payment.razorpayOrderId,
        orderId: dbOrder.payment.razorpayOrderId,
        dbOrderId: String(dbOrder._id),
        amount: Math.round(payableAmount * 100),
        currency: "INR",
        keyId: env.RAZORPAY_KEY_ID,
      }, "Existing Razorpay order reused");
    }
  }

  if (payableAmount <= 0 || payableAmount > MAX_PAYMENT_AMOUNT) {
    return fail(res, "Invalid payment amount", 400);
  }

  let rpOrder;
  try {
    rpOrder = await PaymentService.createRazorpayOrder(orderId || `checkout_${Date.now()}`, payableAmount);
  } catch (err) {
    logger.error("PAYMENT_GATEWAY_ORDER_FAILED", {
      userId: String(getUserId(req) || ""),
      orderId: orderId || null,
      message: err.message,
    });
    return fail(res, "Payment gateway is temporarily unavailable", 502);
  }
  PaymentService.rememberPendingOrder({
    razorpayOrderId: rpOrder.id,
    amount: payableAmount,
    userId: getUserId(req),
  });

  if (dbOrder) {
    dbOrder.payment = {
      ...(dbOrder.payment || {}),
      razorpayOrderId: rpOrder.id,
    };
    await dbOrder.save();
  }

  return ok(res, {
    ...rpOrder,
    orderId: rpOrder.id,
    dbOrderId: dbOrder ? String(dbOrder._id) : null,
    keyId: env.RAZORPAY_KEY_ID,
  }, "Payment order created");
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = normalizeVerifyBody(req.body);

  if (!isObjectId(orderId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return fail(res, "Missing payment verification fields", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return fail(res, "Order not found", 404);
    }
    if (!canAccessOrder(req, order)) {
      await session.abortTransaction();
      session.endSession();
      return fail(res, "Forbidden", 403);
    }

    if (order.paymentStatus === "PAID") {
      await session.abortTransaction();
      session.endSession();
      return ok(res, { verified: true, order }, "Already paid");
    }

    const isValid = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      await trackSignatureFailure(getUserId(req));
      await session.abortTransaction();
      session.endSession();
      return fail(res, "Invalid signature", 400);
    }

    await markOrderPaid({ order, razorpayOrderId, razorpayPaymentId, razorpaySignature, session });

    if (order.couponCode) {
      await orderStackService.finalizeCouponUsage(order.couponCode, session);
    }

    await session.commitTransaction();
    session.endSession();

    logger.info("PAYMENT_VERIFIED", { orderId: String(order._id), paymentId: razorpayPaymentId });
    return ok(res, { verified: true, order }, "Payment verified");
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error("VERIFY_PAYMENT_ERROR", { message: err.message });
    return fail(res, "Payment verification failed", 500);
  }
});

exports.handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body || {}));

  if (!PaymentService.verifyWebhookSignature(rawBody, signature)) {
    logger.error("WEBHOOK_SIGNATURE_INVALID");
    return res.status(400).send("Invalid signature");
  }

  let event;
  try {
    event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
  } catch (err) {
    logger.error("WEBHOOK_PARSE_ERROR", { message: err.message });
    return res.status(400).send("Invalid payload");
  }

  try {
    await PaymentService.handleWebhook(event);
    return res.status(200).send("OK");
  } catch (err) {
    logger.error("WEBHOOK_ERROR", { message: err.message });
    return res.status(500).send("Error");
  }
});
