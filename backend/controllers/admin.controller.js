const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Offer = require("../models/offer.model");
const { ok, fail } = require("../utils/apiResponse");

/**
 * INTERNAL HELPERS (Defined at top to avoid hoisting ReferenceErrors)
 */

const fillMissingDates = (data, days = 7, valueKey = "value") => {
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const existing = data.find((item) => item.date === dateStr);
    result.push({
      date: dateStr,
      label: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
      [valueKey]: existing ? existing[valueKey] : 0,
    });
  }
  return result;
};

// Smart revenue summand to handle legacy field names (total, totalAmount, totalPrice)
// UPDATE: Now strictly filtered by isPaid: true to ensure "Real Revenue" accuracy.
const revenueSummand = { 
  $sum: { 
    $cond: [
      { $eq: ["$isPaid", true] },
      { $ifNull: ["$total", { $ifNull: ["$totalAmount", { $ifNull: ["$totalPrice", 0] }] }] },
      0
    ]
  } 
};

/**
 * ADMIN ANALYTICS & STATS
 */

exports.stats = asyncHandler(async (_req, res) => {
  const [totalUsers, totalOrders, sales, totalProducts, totalOffers] = await Promise.all([
    User.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: null, revenue: revenueSummand } }]),
    Product.countDocuments(),
    Offer.countDocuments()
  ]);

  // LEDGER: Get last 5 real orders for transparency (Shows current business feed)
  const recentTransactions = await Order.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("userId", "name")
    .lean()
    .then(list => list.map(o => ({
      id: o._id,
      customer: o.userId?.name || "Guest",
      amount: o.total || o.totalAmount || o.totalPrice || 0,
      createdAt: o.createdAt,
      status: (o.paymentStatus || (o.isPaid ? "PAID" : "PENDING")).toUpperCase()
    })));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [revTrendRaw, ordTrendRaw] = await Promise.all([
      Order.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo }, isPaid: true } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: revenueSummand } },
          { $project: { date: "$_id", _id: 0, revenue: 1 } },
          { $sort: { date: 1 } }
      ]),
      Order.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, orders: { $sum: 1 } } },
          { $project: { date: "$_id", _id: 0, orders: 1 } },
          { $sort: { date: 1 } }
      ])
  ]);

  const revenueTrend = fillMissingDates(revTrendRaw, 30, "revenue");
  const ordersTrend = fillMissingDates(ordTrendRaw, 30, "orders");

  return ok(res, {
    totalUsers,
    totalOrders,
    totalRevenue: sales[0]?.revenue || 0,
    totalProducts,
    totalOffers,
    recentTransactions,
    revenueTrend,
    ordersTrend
  }, "Stats fetched with filtered fiscal integrity");
});

exports.verifyPaymentExternal = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return fail(res, "OrderId is mandated for fiscal verification", 400);

  // Performance Hammer: Direct update regardless of previous state
  const updated = await Order.findByIdAndUpdate(
    orderId,
    { 
      $set: { 
        isPaid: true, 
        paymentStatus: "PAID", 
        paidAt: new Date(),
        status: "confirmed" // Mark confirmed when paid
      } 
    },
    { new: true }
  ).populate("userId products.productId").lean();

  if (!updated) return fail(res, "Order manifestation missing from registry", 404);

  return ok(res, updated, "Manual payment verification synchronized successfully");
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const data = await User.find({}).sort({ createdAt: -1 }).lean();
  return ok(res, data, "Users fetched");
});

exports.getRevenue = asyncHandler(async (_req, res) => {
  const sales = await Order.aggregate([{ $group: { _id: null, revenue: revenueSummand } }]);
  return ok(res, { totalRevenue: sales[0]?.revenue || 0 }, "Revenue fetched");
});

exports.getOrderStats = asyncHandler(async (_req, res) => {
  const activeOrders = await Order.countDocuments({ status: { $nin: ["delivered", "cancelled"] } });
  return ok(res, { activeOrders }, "Order stats fetched");
});

exports.getCustomerStats = asyncHandler(async (_req, res) => {
  const totalCustomers = await User.countDocuments({ role: "user" });
  return ok(res, { totalCustomers }, "Customer stats fetched");
});

exports.getRevenueTrend = asyncHandler(async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const stats = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo }, isPaid: true } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, total: revenueSummand } },
    { $project: { date: "$_id", _id: 0, revenue: "$total" } },
    { $sort: { date: 1 } },
  ]);
  return ok(res, fillMissingDates(stats, 30, "revenue"), "Revenue trend fetched");
});

exports.getOrderTrend = asyncHandler(async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const stats = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $project: { date: "$_id", _id: 0, orders: "$count" } },
    { $sort: { date: 1 } },
  ]);
  return ok(res, fillMissingDates(stats, 30, "orders"), "Order trend fetched");
});
