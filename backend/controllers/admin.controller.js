const mongoose = require("mongoose");
const Order = require("../models/order.model");
const User = require("../models/user.model");
const Offer = require("../models/offer.model");
const { logger } = require("../utils/logger");
const { ok, fail } = require("../utils/apiResponse");
const cache = require("../services/cache.service");

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDER_STATUSES = ["placed", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled"];
const GST_PERCENT = 18;
const DELIVERY_FEE = 40;
const COD_FEE = 50;

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clampLimit = (value, fallback = 20, max = 100) => {
  const parsed = Math.max(1, parseInt(value, 10) || fallback);
  return Math.min(parsed, max);
};

const getDateRange = (range = "7d") => {
  const now = new Date();
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const start = new Date(now.getTime() - (days - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return { start, days };
};

const pad2 = (value) => String(value).padStart(2, "0");
const dayLabel = (date) => date.toLocaleDateString("en-US", { weekday: "short" });
const dayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const getCachedStats = async (key, fn, ttl = 60) => {
  try {
    return await cache.getOrSetStale(key, fn, ttl, Math.max(ttl * 3, 300));
  } catch (err) {
    logger.warn(`[ADMIN_CACHE_BYPASS] ${key}: ${err.message}`);
    return fn();
  }
};

const publicUserFields = "name email phone role createdAt isVerified";

const getOrderCustomer = (order = {}) => {
  const user = order.userId || order.user || {};
  return (
    order.shippingAddress?.fullName ||
    order.shippingAddress?.name ||
    user.name ||
    user.email ||
    "Guest"
  );
};

const getOrderAmount = (order = {}) => {
  const products = Array.isArray(order.products) ? order.products : [];
  const computedSubtotal = products.reduce((sum, item) => {
    const quantity = Math.max(1, safeNumber(item?.quantity, 1));
    return sum + safeNumber(item?.price) * quantity;
  }, 0);
  const subtotal = safeNumber(order.subtotal, computedSubtotal);
  const discount = safeNumber(order.discount);
  const gstPercent = safeNumber(order.gstPercent ?? order.gst_percent, GST_PERCENT);
  const gst = safeNumber(order.gst, Math.round(subtotal * (gstPercent / 100)));
  const delivery = safeNumber(order.delivery, DELIVERY_FEE) || DELIVERY_FEE;
  const codFee = String(order.paymentMethod || "COD").toUpperCase() === "COD"
    ? Math.max(safeNumber(order.codFee), COD_FEE)
    : 0;

  return Math.max(0, subtotal - discount + gst + delivery + codFee);
};

const normalizeOrder = (order = {}) => ({
  ...order,
  id: String(order._id || order.id || ""),
  _id: order._id,
  user: order.userId || order.user || null,
  customer: getOrderCustomer(order),
  amount: getOrderAmount(order),
  total: getOrderAmount(order),
  status: order.status || "placed",
  paymentStatus: order.paymentStatus || (order.isPaid ? "PAID" : "PENDING"),
  paymentMethod: order.paymentMethod || "COD",
  products: Array.isArray(order.products) ? order.products : [],
  shipmentStatus: order.shipment_status || order.shipment?.status || order.shiprocket?.status || "pending",
  awb: order.shipment?.awb_code || order.shiprocket?.awbCode || null,
  courier: order.shipment?.courier_name || order.shiprocket?.courierName || null,
  trackingId: order.shipment?.tracking_id || order.shiprocket?.trackingId || null,
  trackingUrl: order.shipment?.tracking_url || order.shiprocket?.trackingUrl || null,
  estimatedDelivery: order.shipment?.estimated_delivery || null,
  lastShipmentError: order.shipment?.last_error || order.shiprocket?.error || null,
});

const normalizeOffer = (offer = {}) => ({
  ...offer,
  id: String(offer._id || offer.id || ""),
  _id: offer._id,
  discount: safeNumber(offer.discountValue ?? offer.discount),
  status: getOfferStatus(offer),
});

const getOfferStatus = (offer = {}) => {
  const now = Date.now();
  const start = offer.startDate ? new Date(offer.startDate).getTime() : 0;
  const end = offer.endDate ? new Date(offer.endDate).getTime() : 0;

  if (!offer.isActive) return "OFF";
  if (start && now < start) return "COMING";
  if (end && now > end) return "EXPIRED";
  if (offer.usageLimit && safeNumber(offer.usedCount) >= safeNumber(offer.usageLimit)) return "LIMIT ENDED";
  return "ACTIVE";
};

const buildTrend = (rows, start, days, keyName) => {
  const map = new Map(rows.map((row) => [row._id, row[keyName] || 0]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return {
      label: days <= 7 ? dayLabel(date) : dayKey(date),
      date: dayKey(date),
      [keyName]: safeNumber(map.get(dayKey(date))),
    };
  });
};

const buildDashboardStats = async (range = "7d") => {
  const { start, days } = getDateRange(range);
  const [allOrders, userCount, activeOffers] = await Promise.all([
    Order.find({ isDeleted: { $ne: true } })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .limit(5000)
      .select("subtotal discount delivery codFee gst gstPercent total status paymentStatus paymentMethod createdAt shippingAddress userId products")
      .lean(),
    User.countDocuments({ role: "user", isDeleted: { $ne: true } }),
    Offer.countDocuments({ isActive: true, isDeleted: { $ne: true }, startDate: { $lte: new Date() }, endDate: { $gte: new Date() } }),
  ]);

  const validOrders = allOrders.filter((order) => order.isDeleted !== true);
  const revenueOrders = validOrders.filter((order) => String(order.status || "").toLowerCase() !== "cancelled");
  const revenue = revenueOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  const trendMap = new Map();

  validOrders.forEach((order) => {
    const created = new Date(order.createdAt || Date.now());
    if (Number.isNaN(created.getTime()) || created < start) return;
    const key = dayKey(created);
    const current = trendMap.get(key) || { _id: key, revenue: 0, orders: 0 };
    current.orders += 1;
    if (String(order.status || "").toLowerCase() !== "cancelled") {
      current.revenue += getOrderAmount(order);
    }
    trendMap.set(key, current);
  });

  const trendRows = [...trendMap.values()].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const revenueTrend = buildTrend(trendRows, start, days, "revenue");
  const ordersTrend = buildTrend(trendRows, start, days, "orders");
  const orderCount = validOrders.length;
  const recentOrders = validOrders.slice(0, 10);

  return {
    revenue,
    orders: orderCount,
    customers: userCount,
    activeOffers,
    totalRevenue: revenue,
    totalOrders: orderCount,
    totalUsers: userCount,
    metrics: { revenue, orders: orderCount, customers: userCount, activeOffers },
    revenueTrend,
    ordersTrend,
    recentTransactions: recentOrders.map((order) => ({
      id: String(order._id),
      customer: getOrderCustomer(order),
      amount: getOrderAmount(order),
      status: String(order.status || "placed").toUpperCase(),
      paymentStatus: order.paymentStatus || "PENDING",
      createdAt: order.createdAt,
    })),
    lastUpdated: new Date().toISOString(),
  };
};

exports.getDashboardStats = async (req, res) => {
  try {
    const range = String(req.query.range || "7d");
    const statsResult = await getCachedStats(`dashboard:stats:${range}:v7`, () => buildDashboardStats(range), 60);
    return ok(res, statsResult);
  } catch (err) {
    logger.error("[DASHBOARD_STATS_ERROR]", { message: err.message, stack: err.stack });
    return fail(res, "Failed to load dashboard statistics", 500);
  }
};

exports.stats = exports.getDashboardStats;

exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = clampLimit(req.query.limit, 50, 100);
    const q = String(req.query.q || req.query.search || "").trim();

    const query = { role: { $in: ["user", "admin"] }, isDeleted: { $ne: true } };
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(publicUserFields)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return ok(res, { users, items: users, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    logger.error("[ADMIN_LIST_USERS_ERROR]", { message: err.message });
    return fail(res, "Failed to load users", 500);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, "Invalid user ID", 400);

    const updates = { ...req.body };
    delete updates.password;
    delete updates.role;
    delete updates.token;

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select("-password");
    if (!user) return fail(res, "User not found", 404);
    return ok(res, user, "User updated successfully");
  } catch (err) {
    logger.error("[ADMIN_UPDATE_USER_ERROR]", { message: err.message });
    return fail(res, "Failed to update user", 500);
  }
};

exports.getRevenue = async (_req, res) => {
  const orders = await Order.find({ isDeleted: { $ne: true }, status: { $ne: "cancelled" } }).lean();
  const revenue = orders.reduce((sum, order) => sum + getOrderAmount(order), 0);
  return ok(res, { revenue });
};

exports.getOrderStats = async (_req, res) => {
  const rows = await Order.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const data = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
  rows.forEach((row) => {
    data[row._id || "placed"] = row.count;
  });
  return ok(res, data);
};

exports.getCustomerStats = async (_req, res) => {
  const [totalUsers, totalAdmins] = await Promise.all([
    User.countDocuments({ role: "user", isDeleted: { $ne: true } }),
    User.countDocuments({ role: "admin", isDeleted: { $ne: true } }),
  ]);
  return ok(res, { totalUsers, totalAdmins });
};

exports.getRevenueTrend = async (req, res) => {
  const { start, days } = getDateRange(req.query.range || "30d");
  const orders = await Order.find({ isDeleted: { $ne: true } }).lean();
  const rows = Object.values(orders.reduce((acc, order) => {
    const date = new Date(order.createdAt || Date.now());
    if (Number.isNaN(date.getTime()) || date < start || String(order.status || "").toLowerCase() === "cancelled") return acc;
    const key = dayKey(date);
    acc[key] = acc[key] || { _id: key, revenue: 0 };
    acc[key].revenue += getOrderAmount(order);
    return acc;
  }, {}));
  return ok(res, buildTrend(rows, start, days, "revenue"));
};

exports.getOrderTrend = async (req, res) => {
  const { start, days } = getDateRange(req.query.range || "30d");
  const orders = await Order.find({ isDeleted: { $ne: true } }).lean();
  const rows = Object.values(orders.reduce((acc, order) => {
    const date = new Date(order.createdAt || Date.now());
    if (Number.isNaN(date.getTime()) || date < start) return acc;
    const key = dayKey(date);
    acc[key] = acc[key] || { _id: key, orders: 0 };
    acc[key].orders += 1;
    return acc;
  }, {}));
  return ok(res, buildTrend(rows, start, days, "orders"));
};

exports.verifyPaymentExternal = async (req, res) => {
  const { orderId } = req.body;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) return fail(res, "Valid orderId required", 400);

  const order = await Order.findById(orderId);
  if (!order) return fail(res, "Order not found", 404);
  if (order.paymentStatus === "PAID") return ok(res, order, "Already paid");

  order.paymentStatus = "PAID";
  order.isPaid = true;
  order.paidAt = new Date();
  await order.save();
  return ok(res, order, "Payment updated");
};

exports.uploadInvoiceTemplate = (_req, res) => ok(res, { uploaded: true });

exports.getOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = clampLimit(req.query.limit, 20, 100);
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || req.query.search || "").trim();

    const query = { isDeleted: { $ne: true } };
    if (status) query.status = status;
    if (q && mongoose.Types.ObjectId.isValid(q)) query._id = q;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "name email phone")
        .populate("products.productId", "name title price images primaryImage sku")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const mapped = orders.map(normalizeOrder);
    return ok(res, {
      orders: mapped,
      items: mapped,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    logger.error("[ADMIN_GET_ORDERS_ERROR]", { message: err.message });
    return fail(res, "Failed to fetch orders", 500);
  }
};

exports.getOffers = async (_req, res) => {
  try {
    const offers = await Offer.find({ isDeleted: { $ne: true } }).sort({ priority: -1, createdAt: -1 }).lean();
    const mapped = offers.map(normalizeOffer);
    return ok(res, { offers: mapped, items: mapped });
  } catch (err) {
    logger.error("[ADMIN_GET_OFFERS_ERROR]", { message: err.message });
    return fail(res, "Failed to fetch offers", 500);
  }
};

exports.getShipments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = clampLimit(req.query.limit, 20, 100);
    const status = String(req.query.status || "").trim();

    const query = {
      isDeleted: { $ne: true },
      $or: [
        { "shipment.shipment_id": { $ne: null } },
        { "shipment.awb_code": { $ne: null } },
        { "shiprocket.shipmentId": { $ne: null } },
        { "shiprocket.awbCode": { $ne: null } },
        { "shipment.status": "failed" },
        { shipment_status: "failed" },
        { "shiprocket.status": "FAILED" },
        { status: { $in: ["shipped", "out_for_delivery", "delivered"] } },
      ],
    };

    if (status) query.shipment_status = status;

    const [shipments, total] = await Promise.all([
      Order.find(query)
        .select("_id userId status shipment shipment_status shiprocket createdAt updatedAt total shippingAddress")
        .populate("userId", "name email phone")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const mapped = shipments.map(normalizeOrder);
    return ok(res, {
      shipments: mapped,
      items: mapped,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    logger.error("[ADMIN_GET_SHIPMENTS_ERROR]", { message: err.message });
    return fail(res, "Failed to fetch shipments", 500);
  }
};
