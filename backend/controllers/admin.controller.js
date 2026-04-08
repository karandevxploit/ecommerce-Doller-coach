const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Offer = require("../models/offer.model");
const { ok, fail } = require("../utils/apiResponse");
const paginate = require("../utils/pagination");

exports.stats = asyncHandler(async (_req, res) => {
  const [totalUsers, totalOrders, sales, totalProducts, totalOffers] = await Promise.all([
    User.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([{ $match: { paymentStatus: "PAID" } }, { $group: { _id: null, revenue: { $sum: "$totalAmount" } } }]),
    Product.countDocuments(),
    Offer.countDocuments()
  ]);

  const dailySales = await Order.aggregate([
    { $match: { paymentStatus: "PAID" } },
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" }
        },
        total: { $sum: "$totalAmount" }
      }
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    { $limit: 30 }
  ]);

  const revenueData = (dailySales || []).map((row) => ({
    name: `${row._id.y}-${String(row._id.m).padStart(2, "0")}-${String(row._id.d).padStart(2, "0")}`,
    revenue: row.total || 0,
  }));

  const dailyOrders = await Order.aggregate([
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" },
        },
        orders: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    { $limit: 30 },
  ]);

  const orderData = (dailyOrders || []).map((row) => ({
    name: `${row._id.y}-${String(row._id.m).padStart(2, "0")}-${String(row._id.d).padStart(2, "0")}`,
    orders: row.orders || 0,
  }));

  return ok(res, {
    totalUsers,
    totalOrders,
    totalRevenue: sales[0]?.revenue || 0,
    totalProducts,
    totalOffers,
    dailySales,
    revenueData,
    orderData,
  }, "Stats fetched");
});

exports.listUsers = asyncHandler(async (req, res) => {
  const result = await paginate(User, {}, {
    ...req.query,
    sort: { createdAt: -1 }
  });
  return ok(res, result.data, "Users fetched", 200, result.pagination);
});

exports.uploadInvoiceTemplate = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No template file uploaded" });

  const fs = require("fs");
  const path = require("path");

  const targetDir = path.join(__dirname, "..", "assets");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, "invoice-template.docx");

  // Standardize the upload destination
  fs.renameSync(req.file.path, targetPath);

  return ok(res, { success: true }, "Invoice template updated successfully");
});

