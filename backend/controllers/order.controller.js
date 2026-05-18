const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const orderStackService = require("../services/order.service");
const PaymentService = require("../services/payment.service");
const Order = require("../models/order.model");
const Config = require("../models/config.model");
const { ok, fail } = require("../utils/apiResponse");
const { logger } = require("../utils/logger");
const { publishEvent } = require("../services/outbox.service");
const shiprocketService = require("../services/shiprocket.service");

const ORDER_FLOW = ["placed", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"];
const PAYMENT_STATUSES = new Set(["PENDING", "PAID", "FAILED"]);
const PAYMENT_METHODS = new Set(["COD", "ONLINE", "RAZORPAY"]);
const GST_PERCENT = 18;
const DELIVERY_FEE = 40;
const COD_FEE = 50;

const clean = (value = "") => String(value ?? "").trim();
const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const getUserId = (req) => req.user?._id || req.user?.id;
const clampLimit = (value, fallback = 20, max = 100) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), max);
const formatMoney = (value) => `INR ${safeNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const formatDateTime = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const resolveLocalUploadPath = (url = "") => {
  const imagePath = clean(url);
  if (!imagePath.startsWith("/uploads/") && !imagePath.startsWith("uploads/")) return "";
  const relativePath = imagePath.replace(/^\/+/, "");
  const candidates = [
    path.join(__dirname, "..", relativePath),
    path.join(__dirname, "..", "..", relativePath),
  ];
  return candidates.find((file) => fs.existsSync(file)) || "";
};
const findBrandLogoPath = () => {
  const candidates = [
    path.join(__dirname, "..", "..", "frontend", "src", "assets", "logo.png"),
    path.join(__dirname, "..", "..", "frontend", "dist", "assets", "logo-BkgDQDsk.png"),
  ];
  return candidates.find((file) => fs.existsSync(file)) || "";
};

const getChargeBreakdown = (order = {}) => {
  const products = Array.isArray(order.products) ? order.products : [];
  const computedSubtotal = products.reduce((sum, item) => {
    const quantity = Math.max(1, safeNumber(item.quantity, 1));
    return sum + safeNumber(item.price) * quantity;
  }, 0);
  const subtotal = safeNumber(order.subtotal, computedSubtotal);
  const discount = safeNumber(order.discount);
  const gstPercent = safeNumber(order.gstPercent ?? order.gst_percent, GST_PERCENT);
  const gst = safeNumber(order.gst, Math.round(subtotal * (gstPercent / 100)));
  const delivery = safeNumber(order.delivery, DELIVERY_FEE) || DELIVERY_FEE;
  const isCod = String(order.paymentMethod || "COD").toUpperCase() === "COD";
  const codFee = isCod ? Math.max(safeNumber(order.codFee), COD_FEE) : 0;
  const total = subtotal - discount + gst + delivery + codFee;

  return { subtotal, discount, gst, gstPercent, delivery, codFee, total };
};

const normalizePaymentMethod = (method = "COD") => {
  const value = clean(method).toUpperCase();
  if (!PAYMENT_METHODS.has(value)) return null;
  return value === "RAZORPAY" ? "ONLINE" : value;
};

const normalizeAddress = (address = {}) => {
  const normalized = {
    fullName: clean(address.fullName || address.name),
    name: clean(address.name || address.fullName),
    phone: clean(address.phone).replace(/\D/g, ""),
    addressLine1: clean(address.addressLine1 || address.street || address.address),
    addressLine2: clean(address.addressLine2),
    landmark: clean(address.landmark),
    city: clean(address.city),
    state: clean(address.state),
    pincode: clean(address.pincode || address.zip || address.postalCode).replace(/\D/g, "").slice(0, 6),
  };

  const errors = [];
  if ((normalized.fullName || normalized.name).length < 2) errors.push("Valid full name is required");
  if (!/^\d{10}$/.test(normalized.phone)) errors.push("Valid 10-digit phone number is required");
  if (normalized.addressLine1.length < 5) errors.push("Address is too short");
  if (!normalized.city) errors.push("City is required");
  if (!normalized.state) errors.push("State is required");
  if (!/^\d{6}$/.test(normalized.pincode)) errors.push("Valid 6-digit pincode is required");

  return { address: normalized, errors };
};

const normalizeItems = (body = {}) => {
  const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(body.products) ? body.products : [];
  const errors = [];

  const items = rawItems.map((item, index) => {
    const productId = clean(item.productId || item.id || item._id);
    const quantity = Math.max(1, Math.min(20, parseInt(item.quantity, 10) || 1));
    const price = safeNumber(item.price, 0);

    if (!isObjectId(productId)) errors.push(`Invalid product at item ${index + 1}`);
    if (price < 0) errors.push(`Invalid price at item ${index + 1}`);

    return {
      productId,
      quantity,
      price,
      size: clean(item.size),
      topSize: clean(item.topSize),
      bottomSize: clean(item.bottomSize),
      color: clean(item.color),
      variantIdx: item.variantIdx ?? null,
    };
  });

  if (!items.length) errors.push("Order must contain at least one item");
  return { items, errors };
};

const populateOrder = (query) => query
  .populate("userId", "name email phone")
  .populate("products.productId", "name title price images primaryImage hoverImage category");

const serializeOrder = (order = {}) => ({
  ...order,
  id: String(order._id || order.id || ""),
  user: order.userId || order.user || null,
  items: order.products || [],
  ...(() => {
    const charges = getChargeBreakdown(order);
    return {
      subtotal: charges.subtotal,
      discount: charges.discount,
      delivery: charges.delivery,
      codFee: charges.codFee,
      gst: charges.gst,
      gstPercent: charges.gstPercent,
      total: charges.total,
      deliveryFee: charges.delivery,
      discountAmount: charges.discount,
      gstAmount: charges.gst,
      totalAmount: charges.total,
      charges,
    };
  })(),
});

const confirmAndBookShipment = async (order) => {
  if (!order) return null;

  if (order.status === "cancelled") {
    const err = new Error("Cancelled order cannot be confirmed");
    err.statusCode = 400;
    throw err;
  }

  if (order.status === "delivered") {
    const err = new Error("Delivered order cannot be changed");
    err.statusCode = 400;
    throw err;
  }

  const shouldConfirm = order.status === "placed";

  try {
    await shiprocketService.bookShipmentForOrder(order._id);
  } catch (err) {
    logger.error({
      orderId: String(order._id),
      message: err.message,
      details: err.details || null,
    }, "SHIPROCKET_CONFIRM_BOOKING_FAILED");
    err.statusCode = err.statusCode || 502;
    throw err;
  }

  const confirmedOrder = await Order.findById(order._id);
  if (!confirmedOrder) return null;

  if (shouldConfirm && confirmedOrder.status === "placed") {
    confirmedOrder.status = "confirmed";
    await confirmedOrder.save();
  }

  return Order.findById(order._id).populate("userId", "name email phone").lean();
};

exports.createOrder = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return fail(res, "Unauthorized", 401);

  const { items, errors: itemErrors } = normalizeItems(req.body);
  const { address, errors: addressErrors } = normalizeAddress(req.body.address || req.body.shippingAddress);
  const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
  const couponCode = clean(req.body.couponCode).toUpperCase() || null;

  if (!paymentMethod) return fail(res, "Invalid payment method", 400);
  if (itemErrors.length || addressErrors.length) {
    return fail(res, "Validation failed", 400, [...itemErrors, ...addressErrors]);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const onlinePayment = {};
    if (paymentMethod === "ONLINE") {
      const razorpayOrderId = clean(req.body.razorpay_order_id || req.body.razorpayOrderId);
      const razorpayPaymentId = clean(req.body.razorpay_payment_id || req.body.razorpayPaymentId);
      const razorpaySignature = clean(req.body.razorpay_signature || req.body.razorpaySignature);

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new Error("Payment verification fields are required");
      }

      const isValidPayment = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!isValidPayment) throw new Error("Invalid payment signature");
      onlinePayment.razorpayOrderId = razorpayOrderId;
      onlinePayment.razorpayPaymentId = razorpayPaymentId;
      onlinePayment.razorpaySignature = razorpaySignature;
    }

    const calculated = await orderStackService.validateCartAndCalculateTotal(items, couponCode, paymentMethod);
    if (paymentMethod === "ONLINE") {
      const pendingPayment = PaymentService.validatePendingOrder({
        razorpayOrderId: onlinePayment.razorpayOrderId,
        amount: calculated.total,
        userId,
      });
      if (!pendingPayment.ok) throw new Error(pendingPayment.message);
    }

    const order = await orderStackService.createOrder(
      userId,
      {
        products: calculated.products,
        subtotal: calculated.subtotal,
        discount: calculated.discount,
        delivery: calculated.delivery,
        codFee: calculated.codFee,
        gst: calculated.gst,
        total: calculated.total,
        gstPercent: calculated.gstPercent,
        address,
        paymentMethod,
        couponCode: calculated.coupon?.code || couponCode,
      },
      session
    );

    if (paymentMethod === "ONLINE") {
      order.paymentStatus = "PAID";
      order.status = "confirmed";
      order.isPaid = true;
      order.paidAt = new Date();
      order.payment = {
        ...(order.payment || {}),
        razorpayOrderId: onlinePayment.razorpayOrderId,
        razorpayPaymentId: onlinePayment.razorpayPaymentId,
        razorpaySignature: onlinePayment.razorpaySignature,
      };
      await order.save({ session });
      PaymentService.forgetPendingOrder(onlinePayment.razorpayOrderId);

      if (order.couponCode) {
        await orderStackService.finalizeCouponUsage(order.couponCode, session);
      }
    }

    await publishEvent({
      aggregateType: "order",
      aggregateId: order._id,
      eventType: "ORDER_CREATED",
      payload: {
        orderId: String(order._id),
        customerId: String(userId),
        paymentMethod,
      },
    }, session);

    await session.commitTransaction();
    session.endSession();

    const emailService = require("../services/email.service");
    emailService.sendOrderPlacedEmails({
      orderId: String(order._id),
      customerId: String(userId),
    }).catch((err) => logger.warn("ORDER_EMAIL_FAILED", { message: err.message }));

    return ok(res, {
      order: serializeOrder(order.toObject ? order.toObject() : order),
      orderId: String(order._id),
      _id: order._id,
      id: String(order._id),
    }, "Order created", 201);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error("ORDER_EXECUTION_FAILED", { userId: String(userId), message: err.message });
    return fail(res, err.message || "Failed to create order", 400);
  }
});

exports.getMyOrders = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = clampLimit(req.query.limit, 20, 50);

  const [orders, total] = await Promise.all([
    populateOrder(Order.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
    Order.countDocuments({ userId }),
  ]);

  const items = orders.map(serializeOrder);
  return ok(res, {
    orders: items,
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

exports.getOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = clampLimit(req.query.limit, 20, 100);
  const status = clean(req.query.status);
  const q = clean(req.query.q || req.query.search);

  const query = {};
  if (status) query.status = status;
  if (q && isObjectId(q)) query._id = q;

  const [orders, total] = await Promise.all([
    populateOrder(Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
    Order.countDocuments(query),
  ]);

  const items = orders.map(serializeOrder);
  return ok(res, {
    orders: items,
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!isObjectId(id)) return fail(res, "Invalid order ID", 400);

  const query = { _id: id };
  if (req.user?.role !== "admin") query.userId = userId;

  const order = await populateOrder(Order.findOne(query)).lean();
  if (!order) return fail(res, "Order not found", 404);

  return ok(res, serializeOrder(order));
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const nextStatus = clean(req.body.status).toLowerCase();

  if (!isObjectId(id)) return fail(res, "Invalid order ID", 400);
  if (!ORDER_FLOW.includes(nextStatus)) return fail(res, "Invalid order status", 400);

  const order = await Order.findById(id);
  if (!order) return fail(res, "Order not found", 404);

  const currentIndex = ORDER_FLOW.indexOf(order.status);
  const nextIndex = ORDER_FLOW.indexOf(nextStatus);
  if (order.status !== "cancelled" && nextStatus !== "cancelled" && nextIndex < currentIndex) {
    return fail(res, "Order status cannot move backwards", 400);
  }
  if (order.status === "delivered" && nextStatus !== "delivered") {
    return fail(res, "Delivered order cannot be changed", 400);
  }

  if (nextStatus === "confirmed") {
    const confirmed = await confirmAndBookShipment(order);
    return ok(res, serializeOrder(confirmed), "Order confirmed and sent to Shiprocket");
  }

  order.status = nextStatus;
  await order.save();

  return ok(res, serializeOrder(order.toObject()), "Order status updated");
});

exports.confirmOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isObjectId(id)) return fail(res, "Invalid order ID", 400);

  const order = await Order.findById(id);
  if (!order) return fail(res, "Order not found", 404);

  try {
    const confirmed = await confirmAndBookShipment(order);
    return ok(res, serializeOrder(confirmed), "Order confirmed and sent to Shiprocket");
  } catch (err) {
    return fail(
      res,
      err.message || "Shiprocket booking failed",
      err.statusCode || 502
    );
  }
});

exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const paymentStatus = clean(req.body.paymentStatus || req.body.status).toUpperCase();

  if (!isObjectId(id)) return fail(res, "Invalid order ID", 400);
  if (!PAYMENT_STATUSES.has(paymentStatus)) return fail(res, "Invalid payment status", 400);

  const updates = { paymentStatus };
  if (paymentStatus === "PAID") {
    updates.isPaid = true;
    updates.paidAt = new Date();
    updates.status = "confirmed";
  } else if (paymentStatus === "FAILED") {
    updates.isPaid = false;
  }

  const order = await Order.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!order) return fail(res, "Order not found", 404);

  return ok(res, serializeOrder(order), "Payment status updated");
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const id = clean(orderId || req.body.id);

  if (!isObjectId(id) || !signature) return fail(res, "Invalid request", 400);
  if (!process.env.RAZORPAY_KEY_SECRET) return fail(res, "Payment verification unavailable", 503);

  const payload = razorpayOrderId && paymentId ? `${razorpayOrderId}|${paymentId}` : id;
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(payload).digest("hex");
  if (expected !== signature) return fail(res, "Invalid payment signature", 403);

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: id, isPaid: { $ne: true } },
    {
      $set: {
        isPaid: true,
        paymentStatus: "PAID",
        status: "confirmed",
        paidAt: new Date(),
        "payment.razorpayOrderId": razorpayOrderId || null,
        "payment.razorpayPaymentId": paymentId || null,
        "payment.razorpaySignature": signature,
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    const existing = await Order.findById(id).lean();
    return ok(res, existing ? serializeOrder(existing) : null, "Already paid");
  }

  if (updatedOrder.couponCode) {
    await orderStackService.finalizeCouponUsage(updatedOrder.couponCode)
      .catch((err) => logger.warn("COUPON_FINALIZE_FAILED", { orderId: String(updatedOrder._id), message: err.message }));
  }

  await publishEvent({
    aggregateType: "payment",
    aggregateId: updatedOrder._id,
    eventType: "PAYMENT_VERIFIED",
    payload: { orderId: String(updatedOrder._id), userId: String(updatedOrder.userId) },
  }).catch((err) => logger.warn("PAYMENT_OUTBOX_FAILED", { message: err.message }));

  return ok(res, serializeOrder(updatedOrder.toObject()), "Payment verified");
});

exports.canUserReview = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { productId } = req.params;
  if (!isObjectId(productId)) return fail(res, "Invalid product ID", 400);

  const order = await Order.findOne({
    userId,
    status: "delivered",
    "products.productId": productId,
  }).select("_id").lean();

  return ok(res, { canReview: Boolean(order), eligible: Boolean(order) });
});

exports.downloadInvoice = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!isObjectId(id)) return fail(res, "Invalid order ID", 400);

  const query = { _id: id };
  if (req.user?.role !== "admin") query.userId = userId;
  const order = await Order.findOne(query).lean();
  if (!order) return fail(res, "Order not found", 404);

  const config = typeof Config.getSingleton === "function"
    ? await Config.getSingleton()
    : await Config.findOne().lean();
  const company = {
    name: clean(config?.company_name) || "Doller Coach",
    email: clean(config?.email),
    phone: clean(config?.phone),
    gst: clean(config?.gst),
    address: clean(config?.address),
  };
  const shipping = order.shippingAddress || order.address || {};
  const products = Array.isArray(order.products) ? order.products : [];
  const charges = getChargeBreakdown(order);
  const invoiceNumber = order.invoiceNumber || `INV-${String(order._id).slice(-8).toUpperCase()}`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${String(order._id).slice(-8).toUpperCase()}.pdf"`);
  res.setHeader("Cache-Control", "no-store");

  const doc = new PDFDocument({ size: "A4", margin: 22, bufferPages: true });
  doc.on("error", (err) => {
    logger.error("INVOICE_PDF_ERROR", { orderId: String(order._id), message: err.message });
    if (!res.headersSent) fail(res, "Failed to generate invoice", 500);
  });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - 44;
  const left = 22;
  const right = pageWidth - 22;
  const logoPath = findBrandLogoPath();

  doc.lineWidth(1.2).strokeColor("#111111").rect(8, 8, pageWidth - 16, pageHeight - 16).stroke();

  if (logoPath) {
    doc.image(logoPath, 76, 28, { width: 86, height: 74, fit: [86, 74] });
  } else {
    doc.font("Helvetica-Bold").fontSize(38).fillColor("#111111").text("DC", 92, 42, { width: 70, align: "center" });
  }

  doc.font("Helvetica-Bold").fontSize(22).fillColor("#111111").text(company.name.toUpperCase(), left + 12, 100, { width: 220, align: "center" });
  doc.moveTo(left + 70, 127).lineTo(left + 238, 127).strokeColor("#111111").stroke();
  doc.font("Helvetica").fontSize(7).fillColor("#111111").text("PREMIUM FASHION & LIFESTYLE BRAND", left + 72, 131, { width: 166, align: "center" });

  doc.moveTo(278, 50).lineTo(278, 225).strokeColor("#9ca3af").stroke();
  doc.font("Helvetica-Bold").fontSize(31).fillColor("#111111").text("INVOICE", 366, 56, { width: 170, align: "center" });

  const metaX = 302;
  const metaY = 112;
  const metaW = 250;
  const metaRows = [
    ["Invoice No", invoiceNumber],
    ["Order ID", String(order._id)],
    ["Date", formatDateTime(order.createdAt)],
    ["Payment", `${order.paymentMethod || "COD"} / ${order.paymentStatus || "PENDING"}`],
  ];
  doc.rect(metaX, metaY, metaW, 86).strokeColor("#111111").stroke();
  metaRows.forEach(([label, value], index) => {
    const rowY = metaY + index * 21.5;
    if (index > 0) doc.moveTo(metaX, rowY).lineTo(metaX + metaW, rowY).strokeColor("#d1d5db").stroke();
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#111111").text(label, metaX + 9, rowY + 7, { width: 70 });
    doc.font("Helvetica").fontSize(7).text(":", metaX + 82, rowY + 7);
    doc.text(String(value), metaX + 99, rowY + 7, { width: 138 });
  });

  const contactY = 156;
  const contactRows = [
    ["Phone", company.phone || shipping.phone || ""],
    ["Email", company.email || ""],
    ["GST", company.gst || ""],
  ].filter(([, value]) => value);
  contactRows.forEach(([label, value], index) => {
    const rowY = contactY + index * 17;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111").text(`${label}:`, left + 30, rowY, { width: 44 });
    doc.font("Helvetica").fontSize(8).text(value, left + 75, rowY, { width: 170 });
  });

  const billY = 230;
  doc.rect(left + 3, billY, 96, 22).fill("#050505");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text("BILL TO", left + 36, billY + 7);
  doc.rect(left + 3, billY + 22, 240, 88).strokeColor("#111111").stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(shipping.fullName || shipping.name || "Customer", left + 14, billY + 34, { width: 210 });
  doc.font("Helvetica").fontSize(8).fillColor("#111111").text([
    shipping.phone && `Phone: ${shipping.phone}`,
    shipping.addressLine1 || shipping.address,
    shipping.addressLine2,
    [shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(", "),
  ].filter(Boolean).join("\n"), left + 14, billY + 50, { width: 210, lineGap: 2 });

  const tableY = 360;
  const tableX = left + 3;
  const tableW = contentWidth - 6;
  const itemW = 250;
  const qtyW = 96;
  const priceW = 106;
  const totalW = tableW - itemW - qtyW - priceW;
  doc.rect(tableX, tableY, tableW, 24).fill("#050505");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
    .text("ITEM", tableX, tableY + 8, { width: itemW, align: "center" })
    .text("QTY", tableX + itemW, tableY + 8, { width: qtyW, align: "center" })
    .text("PRICE", tableX + itemW + qtyW, tableY + 8, { width: priceW, align: "center" })
    .text("TOTAL", tableX + itemW + qtyW + priceW, tableY + 8, { width: totalW, align: "center" });

  let rowY = tableY + 24;
  const rowH = Math.max(72, products.length * 72);
  doc.rect(tableX, rowY, tableW, rowH).strokeColor("#111111").stroke();
  [tableX + itemW, tableX + itemW + qtyW, tableX + itemW + qtyW + priceW].forEach((x) => {
    doc.moveTo(x, tableY).lineTo(x, rowY + rowH).strokeColor("#111111").stroke();
  });

  if (!products.length) {
    doc.font("Helvetica").fontSize(9).fillColor("#111111").text("No products found", tableX + 12, rowY + 28, { width: itemW - 24 });
  } else {
    products.forEach((item, index) => {
      const y = rowY + index * 72;
      if (index > 0) doc.moveTo(tableX, y).lineTo(tableX + tableW, y).strokeColor("#e5e7eb").stroke();
      const imageFile = resolveLocalUploadPath(item.image);
      if (imageFile) {
        try {
          doc.rect(tableX + 10, y + 10, 55, 52).strokeColor("#9ca3af").stroke();
          doc.image(imageFile, tableX + 13, y + 13, { fit: [49, 46], align: "center", valign: "center" });
        } catch {
          doc.rect(tableX + 10, y + 10, 55, 52).strokeColor("#9ca3af").stroke();
        }
      } else {
        doc.rect(tableX + 10, y + 10, 55, 52).strokeColor("#9ca3af").stroke();
      }

      const quantity = Math.max(1, safeNumber(item.quantity, 1));
      const price = safeNumber(item.price);
      const lineTotal = price * quantity;
      const sizeInfo = [item.color, item.size || [item.topSize, item.bottomSize].filter(Boolean).join("/")].filter(Boolean).join(" / ");
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111").text(item.title || item.name || `Item ${index + 1}`, tableX + 78, y + 24, { width: 155 });
      if (sizeInfo) doc.font("Helvetica").fontSize(7).text(sizeInfo, tableX + 78, y + 37, { width: 155 });
      doc.font("Helvetica").fontSize(8).text(String(quantity), tableX + itemW, y + 31, { width: qtyW, align: "center" });
      doc.text(formatMoney(price), tableX + itemW + qtyW, y + 31, { width: priceW, align: "center" });
      doc.text(formatMoney(lineTotal), tableX + itemW + qtyW + priceW, y + 31, { width: totalW, align: "center" });
    });
  }

  const stampX = left + 45;
  const stampY = 535;
  doc.circle(stampX + 42, stampY + 42, 36).strokeColor("#111111").lineWidth(1).stroke();
  doc.circle(stampX + 42, stampY + 42, 25).stroke();
  doc.font("Helvetica-Bold").fontSize(17).fillColor("#111111").text("DC", stampX + 24, stampY + 32, { width: 36, align: "center" });
  doc.font("Helvetica-Bold").fontSize(5.5).text("DOLLER COACH", stampX + 16, stampY + 13, { width: 52, align: "center" });
  doc.font("Helvetica-Bold").fontSize(5.5).text("DOLLER COACH", stampX + 16, stampY + 62, { width: 52, align: "center" });

  const sumX = 296;
  const sumY = 520;
  const sumW = 236;
  const sumRows = [
    ["Subtotal", charges.subtotal],
    ["Discount", -charges.discount],
    [`GST (${charges.gstPercent}%)`, charges.gst],
    ["Delivery", charges.delivery],
    ["COD Fee", charges.codFee],
  ];
  doc.rect(sumX, sumY, sumW, 110).strokeColor("#111111").stroke();
  sumRows.forEach(([label, value], index) => {
    const y = sumY + index * 18;
    if (index > 0) doc.moveTo(sumX, y).lineTo(sumX + sumW, y).strokeColor("#d1d5db").stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111").text(label, sumX + 12, y + 6, { width: 90 });
    doc.font("Helvetica").fontSize(8).text(formatMoney(value), sumX + 120, y + 6, { width: 104, align: "right" });
  });
  doc.moveTo(sumX, sumY + 90).lineTo(sumX + sumW, sumY + 90).strokeColor("#111111").stroke();
  doc.font("Helvetica-Bold").fontSize(11).text("Total", sumX + 12, sumY + 96, { width: 90 });
  doc.font("Helvetica-Bold").fontSize(12).text(formatMoney(charges.total), sumX + 120, sumY + 95, { width: 104, align: "right" });

  const thanksY = 650;
  doc.moveTo(130, thanksY + 9).lineTo(245, thanksY + 9).strokeColor("#111111").stroke();
  doc.moveTo(350, thanksY + 9).lineTo(465, thanksY + 9).stroke();
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111").text("*  THANK YOU  *", 246, thanksY, { width: 105, align: "center" });
  doc.font("Helvetica").fontSize(8).text("for shopping with Doller Coach.", 220, thanksY + 18, { width: 155, align: "center" });

  doc.moveTo(left + 3, 715).lineTo(right - 3, 715).strokeColor("#111111").stroke();
  doc.font("Helvetica-Bold").fontSize(8).text("NOTES", left + 45, 731);
  doc.font("Helvetica").fontSize(6.5).text("Goods once sold will not be taken back unless damaged.\nThis is a computer-generated invoice and does not require a signature.", left + 45, 745, { width: 260, lineGap: 2 });
  doc.font("Helvetica-Bold").fontSize(7).text("THANK YOU FOR\nSHOPPING WITH\nDOLLER COACH", 460, 733, { width: 86, align: "center" });

  doc.end();
});

exports.exportOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 }).limit(5000).lean();
  const rows = [
    "orderId,invoiceNumber,status,paymentStatus,total,createdAt",
    ...orders.map((order) => [
      order._id,
      order.invoiceNumber || "",
      order.status || "",
      order.paymentStatus || "",
      safeNumber(order.total),
      order.createdAt ? new Date(order.createdAt).toISOString() : "",
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"orders.csv\"");
  return res.send(rows.join("\n"));
});
