const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");

const orderRepository = require("../repositories/order.repository");
const orderStackService = require("../services/order.service");
const Order = require("../models/order.model");

const { ok, fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");
const { createOrderSchema } = require("../validations/order.validation");

const { safeCall } = require("../config/redis");

// ===============================
// CREATE ORDER (FULL SAFE)
// ===============================
exports.createOrder = asyncHandler(async (req, res) => {
  const payload = createOrderSchema.parse(req.body);
  const { products, address, paymentMethod, couponCode } = payload;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. IDEMPOTENCY CHECK
    const key = `order:${req.user._id}:${JSON.stringify(products)}`;
    const exists = await safeCall(r => r.get(key));
    if (exists) {
      await session.abortTransaction();
      return fail(res, "Duplicate order request", 409);
    }

    // 2. VALIDATE CART + CALCULATE
    const validation = await orderStackService.validateCartAndCalculateTotal(products, couponCode);

    // 3. ATOMIC ORDER CREATE
    const order = await orderStackService.createOrder(
      req.user._id,
      {
        ...validation,
        address,
        paymentMethod,
        couponCode: couponCode?.toUpperCase() || null,
      },
      session
    );

    // 4. COUPON LOCK (CRITICAL)
    if (couponCode) {
      const updated = await require("../models/coupon.model").updateOne(
        {
          code: couponCode.toUpperCase(),
          $expr: { $lt: ["$usedCount", "$usageLimit"] }
        },
        { $inc: { usedCount: 1 } },
        { session }
      );

      if (!updated.modifiedCount) {
        throw new Error("Coupon usage limit reached");
      }
    }

    // 5. SAVE IDEMPOTENCY KEY
    safeCall(r => r.set(key, "1", "EX", 60));

    await session.commitTransaction();
    session.endSession();

    // 6. SHIPROCKET AUTO-FULFILLMENT (For COD)
    if (paymentMethod === "COD") {
      const { heavyTaskQueue } = require("../services/queue.service");
      heavyTaskQueue.add("shiprocket-fulfillment", { orderId: order._id })
        .catch(err => logger.error("QUEUING_SHIPROCKET_COD_FAIL", err));
    }

    // 7. ASYNC EMAIL (non-blocking)
    const { emailQueue } = require("../services/queue.service");
    emailQueue.add("order-placed", { orderId: order._id, customerId: req.user._id })
      .catch(err => logger.error("QUEUING_EMAIL_FAIL", err));

    return ok(res, order, "Order created", 201);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    logger.error("ORDER ERROR", err);
    return fail(res, err.message, 400);
  }
});

// ===============================
// VERIFY PAYMENT (CRITICAL)
// ===============================
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, signature } = req.body;

  if (!orderId || !signature) {
    return fail(res, "Invalid request", 400);
  }

  const order = await Order.findById(orderId);
  if (!order) return fail(res, "Order not found", 404);

  // Razorpay signature verify
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(orderId)
    .digest("hex");

  if (expected !== signature) {
    return fail(res, "Invalid payment signature", 403);
  }

  if (order.isPaid) {
    return ok(res, order, "Already paid");
  }

  order.isPaid = true;
  order.paymentStatus = "PAID";
  order.paidAt = new Date();

  await order.save();

  // SHIPROCKET AUTO-FULFILLMENT (For ONLINE)
  const { heavyTaskQueue } = require("../services/queue.service");
  heavyTaskQueue.add("shiprocket-fulfillment", { orderId: order._id })
    .catch(err => logger.error("QUEUING_SHIPROCKET_ONLINE_FAIL", err));

  return ok(res, order, "Payment verified");
});

// ===============================
// GET MY ORDERS (OPTIMIZED)
// ===============================
exports.getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  const data = await Order.find({ userId })
    .select("total status paymentStatus createdAt")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return ok(res, data);
});

// ===============================
// GET ORDERS (ADMIN - PAGINATED)
// ===============================
exports.getOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const status = req.query.status;

  const filter = {};
  if (status && status !== "ALL") {
    filter.status = status.toLowerCase();
  }

  const total = await Order.countDocuments(filter);
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return ok(res, orders, "Orders fetched", 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

// ===============================
// UPDATE PAYMENT STATUS (ADMIN)
// ===============================
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, isPaid } = req.body;
  
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { 
        paymentStatus: paymentStatus?.toUpperCase(),
        isPaid: !!isPaid,
        paidAt: isPaid ? new Date() : null
    },
    { new: true }
  );

  if (!order) return fail(res, "Order not found", 404);

  return ok(res, order, "Payment status updated");
});

// ===============================
// EXPORT ORDERS (ADMIN)
// ===============================
exports.exportOrders = asyncHandler(async (req, res) => {
  // Simple CSV export logic stub or full implementation
  const orders = await Order.find().sort({ createdAt: -1 }).limit(1000).lean();
  
  if (!orders.length) return fail(res, "No orders to export", 404);

  const csvRows = [
    ["Order ID", "Customer ID", "Total", "Status", "Payment", "Date"].join(",")
  ];

  orders.forEach(o => {
    csvRows.push([
      o._id,
      o.userId,
      o.total,
      o.status,
      o.paymentStatus,
      o.createdAt.toISOString()
    ].join(","));
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=orders-export-${Date.now()}.csv`);
  return res.status(200).send(csvRows.join("\n"));
});

// ===============================
// UPDATE ORDER STATUS (SAFE)
// ===============================
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const { status } = req.body;

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!order) return fail(res, "Not found", 404);

  return ok(res, order);
});

// ===============================
// GET SINGLE ORDER (SAFE)
// ===============================
exports.getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("userId", "name email")
    .lean();

  if (!order) return fail(res, "Order not found", 404);

  // Security check: only owner or admin can see it
  if (req.user.role !== "admin" && String(order.userId._id) !== String(req.user._id)) {
    return fail(res, "Forbidden", 403);
  }

  return ok(res, order);
});

// ===============================
// CAN USER REVIEW (ELIGIBILITY)
// ===============================
exports.canUserReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Check if user has a DELIVERED order with this product
  const exists = await Order.exists({
    userId,
    status: "delivered",
    "products.productId": productId
  });

  return ok(res, { canReview: !!exists });
});

// ===============================
// DOWNLOAD INVOICE (SAFE)
// ===============================
exports.downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) return fail(res, "Not found", 404);

  if (
    req.user.role !== "admin" &&
    String(order.userId) !== String(req.user._id)
  ) {
    return fail(res, "Forbidden", 403);
  }

  const buffer = await require("../services/invoice.service")
    .buildPdfBuffer(order);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${order._id}.pdf`);
  return res.send(buffer);
});