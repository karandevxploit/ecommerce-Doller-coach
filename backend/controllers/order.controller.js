const orderRepository = require("../repositories/order.repository");
const orderStackService = require("../services/order.service");
const Order = require("../models/order.model");
const { buildPdfBuffer } = require("../services/invoice.service");
const { ok, fail } = require("../utils/apiResponse");
const { sendOrderToAdmin, sendOrderStatusToUser } = require("../utils/sendEmail");
const asyncHandler = require("express-async-handler");
const logger = require("../utils/logger");
const paginate = require("../utils/pagination");

exports.createOrder = asyncHandler(async (req, res) => {
  const { products, address, paymentMethod, couponCode } = req.body;
  
  logger.info(`Creating order for user: ${req.user._id}`);

  if (!products || products.length === 0) {
    return fail(res, "No products in order", 400);
  }

  if (!address || !address.phone) {
    return fail(res, "Shipping address and phone number are required", 400);
  }

  if (!paymentMethod) {
    return fail(res, "Payment method is required", 400);
  }

  try {
    // 1. Validate cart and calculate totals on the server
    const validation = await orderStackService.validateCartAndCalculateTotal(products, couponCode);
    
    // 2. Create the order with atomic stock updates
    const orderData = {
      ...validation,
      address,
      paymentMethod,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
    };

    const createdOrder = await orderStackService.createOrder(req.user._id, orderData);

    // 3. Trigger Async Tasks (Non-blocking)
    sendOrderToAdmin(createdOrder).catch(err => logger.error("Admin Order Email Failed:", err));

    return ok(res, createdOrder, "Order placed successfully", 201);
  } catch (error) {
    logger.error("Order Creation Error:", error);
    return fail(res, error.message, 400);
  }
});

exports.getMyOrders = asyncHandler(async (req, res) => {
  const result = await paginate(Order, { userId: req.user._id }, { 
    ...req.query, 
    populate: "products.productId" 
  });

  return ok(res, result.data, "Orders fetched", 200, result.pagination);
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const order = await orderRepository.findById(req.params.id);
  if (!order) return fail(res, "Order not found", 404);

  // Security: only owner or admin can view
  if (req.user.role !== "admin" && String(order.userId) !== String(req.user._id)) {
    return fail(res, "Forbidden", 403);
  }

  // Populate manually or use a specialized repo method
  const populatedOrder = await order.populate([
    { path: "userId", select: "name email phone" },
    { path: "products.productId" }
  ]);

  return ok(res, populatedOrder);
});

exports.getOrders = asyncHandler(async (req, res) => {
  const result = await paginate(Order, {}, { 
    ...req.query, 
    populate: "userId products.productId" 
  });

  return ok(res, result.data, "Admin orders fetched", 200, result.pagination);
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await orderRepository.updateById(req.params.id, { status });

  if (!order) return fail(res, "Order not found", 404);

  sendOrderStatusToUser(order).catch(err => logger.error("User Status Email Failed:", err));

  return ok(res, order, "Order status updated");
});

exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Marking order ${id} as PAID`);
  
  const order = await orderRepository.findById(id);
  if (!order) return fail(res, "Order not found", 404);

  if (order.paymentStatus === "PAID") {
    return ok(res, order, "Order is already marked as paid");
  }

  const updatedOrder = await orderRepository.updateById(id, {
    isPaid: true,
    paymentStatus: "PAID",
    paidAt: new Date()
  });

  return ok(res, updatedOrder, "Order marked as paid successfully");
});

exports.downloadInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await orderRepository.findById(id);

  if (!order) return fail(res, "Order not found", 404);

  if (req.user.role !== "admin" && String(order.userId) !== String(req.user._id)) {
    return fail(res, "Forbidden", 403);
  }

  const User = require("../models/user.model");
  const customer = await User.findById(order.userId).lean();
  const buffer = await buildPdfBuffer(order, customer);

  const filename = `INVOICE-${String(order._id).slice(-8).toUpperCase()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  
  return res.send(buffer);
});

exports.canUserReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Find a delivered order for this user containing this product
  const order = await Order.findOne({
    userId,
    status: "delivered",
    "products.productId": productId
  });

  return ok(res, { canReview: !!order }, "Review eligibility checked");
});

exports.exportOrders = asyncHandler(async (req, res) => {
  logger.info(`Exporting all orders for admin: ${req.user._id}`);
  const orders = await Order.find()
    .populate("userId", "name email phone")
    .populate("products.productId", "title sku price")
    .sort({ createdAt: -1 });

  return ok(res, orders, "Orders data exported successfully");
});
