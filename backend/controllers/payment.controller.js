const PaymentService = require("../services/payment.service");
const orderRepository = require("../repositories/order.repository");
const { ok, fail } = require("../utils/apiResponse");
const asyncHandler = require("express-async-handler");
const logger = require("../utils/logger");
const env = require("../config/env");

exports.createPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return fail(res, "orderId is required", 400);

  const order = await orderRepository.findById(orderId);
  if (!order) return fail(res, "Order not found", 404);

  // Security check: only the owner or an admin can create a payment order
  if (req.user.role !== "admin" && String(order.userId) !== String(req.user._id)) {
    return fail(res, "Forbidden", 403);
  }

  if (order.paymentStatus === "PAID") {
    return fail(res, "Order already paid", 409);
  }

  const rpOrder = await PaymentService.createRazorpayOrder(order._id, order.totalAmount);
  
  order.payment.razorpayOrderId = rpOrder.id;
  await order.save();

  return ok(res, {
    order: rpOrder,
    keyId: env.RAZORPAY_KEY_ID,
    orderId: String(order._id),
  }, "Razorpay order created");
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;
  
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !orderId) {
    return fail(res, "Missing payment verification fields", 400);
  }

  const order = await orderRepository.findById(orderId);
  if (!order) return fail(res, "Order not found", 404);

  if (order.paymentStatus === "PAID") {
    return ok(res, { verified: true, order }, "Payment already verified");
  }

  const isValid = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    logger.warn(`Invalid payment signature attempt: ${orderId}`);
    return fail(res, "Invalid payment signature", 400);
  }

  // Idempotency check: don't process if already paid (can happen with concurrent webhook)
  if (order.paymentStatus === "PAID") {
    return ok(res, { verified: true, order }, "Payment already processed");
  }

  const updatedOrder = await orderRepository.updatePaymentInfo(order._id, {
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
    status: "PAID",
  });

  const orderService = require("../services/order.service");
  if (updatedOrder.couponCode) {
    await orderService.finalizeCouponUsage(updatedOrder.couponCode);
  }

  logger.info(`Payment verified and order updated: ${orderId}`);

  // In a real application, you'd trigger notifications and invoice generation here or via the Service
  return ok(res, { verified: true, order: updatedOrder }, "Payment verified successfully");
});

exports.handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const body = req.body;

  if (!PaymentService.verifyWebhookSignature(req.rawBody, signature)) {
    logger.error("Invalid Razorpay Webhook Signature");
    return res.status(400).send("Invalid signature");
  }

  // Process asynchronously if needed, but here we process directly
  await PaymentService.handleWebhook(body);

  return res.status(200).send("OK");
});
