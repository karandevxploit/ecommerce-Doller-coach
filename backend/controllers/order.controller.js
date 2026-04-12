const orderRepository = require("../repositories/order.repository");
const mongoose = require("mongoose");
const orderStackService = require("../services/order.service");
const Order = require("../models/order.model");
const { buildPdfBuffer } = require("../services/invoice.service");
const { ok, fail } = require("../utils/apiResponse");
const emailService = require("../services/email.service"); // Switched to high-fidelity EmailService
const asyncHandler = require("express-async-handler");
const logger = require("../utils/logger");

exports.createOrder = asyncHandler(async (req, res) => {
  console.log("REQ BODY:", req.body);
  const { products, address, paymentMethod, couponCode, subtotal } = req.body;
  const discount = req.body.discount || 0;
  
  logger.info(`Creating order for user: ${req.user._id}`);

  if (!products || products.length === 0) {
    return fail(res, "No products in order", 400);
  }

  if (subtotal === undefined || subtotal === null) {
    return fail(res, "Subtotal is required for fiscal validation", 400);
  }

  if (discount === undefined || discount === null) {
    return fail(res, "Discount field is required", 400);
  }

  if (!address || !address.phone) {
    return fail(res, "Shipping address and phone number are required", 400);
  }

  if (!paymentMethod) {
    return fail(res, "Payment method is required", 400);
  }

  try {
    // 1. Validate cart and calculate totals on the server (Sovereign authority)
    const validation = await orderStackService.validateCartAndCalculateTotal(products, couponCode);
    
    // 2. Create the order with atomic stock updates
    const orderData = {
      ...validation,
      address,
      paymentMethod,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
    };

    const createdOrder = await orderStackService.createOrder(req.user._id, orderData);
    
    // 3. Trigger Async Professional Email (Confirmation to User + Admin)
    logger.info(`[TRACE] Triggering Order Confirmation Emails for #${createdOrder._id}`);
    emailService.sendOrderPlacedEmails({ order: createdOrder, customer: req.user })
      .catch(err => logger.error(`[TRACE ERROR] sendOrderPlacedEmails FAILED: ${err.message}`));

    return ok(res, createdOrder, "Order placed successfully", 201);
  } catch (error) {
    logger.error("Order Creation Error:", error);
    return fail(res, error.message, 400);
  }
});

exports.getMyOrders = asyncHandler(async (req, res, next) => {
  logger.info(`[TRACE-ORDER] getMyOrders HIT - User: ${req.user?._id}`);
  try {
    const rawUserId = req.user?._id || req.user?.id;
    if (!rawUserId) return fail(res, "Authentication context lost. Please re-login.", 401);

    const userId = new mongoose.Types.ObjectId(rawUserId);
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: "products.productId",
      sort: { createdAt: -1 },
      lean: true
    };

    // 100% WORKING SOLUTION: Use plugin if available, fallback to find
    // $or query handles both modern 'userId' and legacy 'user' field names
    const query = { $or: [{ userId }, { user: userId }] };
    
    let result;
    if (typeof Order.paginate === "function") {
      const paginated = await Order.paginate(query, options);
      result = {
        data: paginated.docs,
        pagination: { 
          total: paginated.totalDocs, 
          page: paginated.page, 
          limit: paginated.limit, 
          pages: paginated.totalPages 
        }
      };
    } else {
      logger.warn("Order.paginate is missing - using critical fallback");
      const data = await Order.find({ userId }).populate(options.populate).sort(options.sort).lean();
      result = { data, pagination: { total: data.length, page: 1, limit: data.length, pages: 1 } };
    }

    if (!result || !result.data) return ok(res, [], "No records localized");

    return ok(res, result.data, "Manifest retrieved", 200, result.pagination);
  } catch (error) {
    logger.error(`[CRITICAL ORDER FAILURE] User: ${req.user?._id} - Error: ${error.message}`, {
      stack: error.stack,
      requestId: req.requestId
    });
    return res.status(500).json({ success: false, message: "Internal record reconciliation failed", requestId: req.requestId });
  }
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return fail(res, "Invalid identifier format", 400);
  }

  // 100% WORKING SOLUTION: populate during find or manual populate
  const order = await Order.findById(id)
    .populate("userId", "name email phone")
    .populate("products.productId")
    .lean();

  if (!order) return fail(res, "Order not found", 404);

  // Security: only owner or admin can view
  const ownerId = order.userId?._id?.toString() || order.userId?.toString();
  if (req.user.role !== "admin" && ownerId !== req.user._id.toString()) {
    return fail(res, "Forbidden access to manifest", 403);
  }

  return ok(res, order, "Order manifest retrieved");
});

exports.getOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: "userId products.productId",
    sort: { createdAt: -1 },
    lean: true
  };

  if (typeof Order.paginate === "function") {
    const paginated = await Order.paginate({}, options);
    return ok(res, paginated.docs, "Admin orders fetched", 200, {
      total: paginated.totalDocs,
      page: paginated.page,
      limit: paginated.limit,
      pages: paginated.totalPages
    });
  } else {
    const data = await Order.find({}).populate(options.populate).sort(options.sort).lean();
    return ok(res, data, "Admin orders fetched (fallback)", 200, { total: data.length, page: 1, limit: data.length, pages: 1 });
  }
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await orderRepository.updateById(req.params.id, { status });

  if (!order) return fail(res, "Order not found", 404);

  // Security & Deliverability: Populate user to get email for notification
  const customer = await require("../models/user.model").findById(order.userId).lean();
  
  if (customer) {
    logger.info(`[TRACE] Triggering Status Update Email [${status}] for #${order._id} to ${customer.email}`);
    emailService.sendOrderStatusEmail({ order, customer })
      .catch(err => logger.error(`[TRACE ERROR] sendOrderStatusEmail FAILED: ${err.message}`));
  } else {
    logger.warn(`[TRACE] Skipping Status Email: Customer not found for order ${order._id}`);
  }

  return ok(res, order, `Order status updated to ${status}`);
});

exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`[ADMIN] Explicitly marking order ${id} as PAID`);
  
  const order = await Order.findById(id);
  if (!order) return fail(res, "Order not found", 404);

  // Atomic update to ensure isPaid, paymentStatus, and paidAt are synchronized
  const updatedOrder = await Order.findByIdAndUpdate(
    id,
    {
      $set: {
        isPaid: true,
        paymentStatus: "PAID",
        paidAt: new Date()
      }
    },
    { new: true, runValidators: true }
  ).populate("userId products.productId").lean();

  if (!updatedOrder) return fail(res, "Update synchronization failed", 500);

  return ok(res, updatedOrder, "Order manifest verified and marked as paid");
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
