const Order = require("../models/order.model");
const User = require("../models/user.model");
const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");

/**
 * CACHE WRAPPER
 */
const getCachedStats = async (key, fn, ttl = 300) => {
  const cached = await safeCall(async (redis) => {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  });

  if (cached) return cached;

  const fresh = await fn();

  safeCall(async (redis) => {
    await redis.set(key, JSON.stringify(fresh), "EX", ttl);
  }).catch(() => { });

  return fresh;
};

/**
 * ADMIN: DASHBOARD ANALYTICS
 */
exports.stats = async (req, res) => {
  try {
    const statsResult = await getCachedStats("admin:stats", async () => {
      // Run queries in parallel for maximum speed 🚀
      const [revDataArr, totalOrders, totalUsers, recentTransactionsData] = await Promise.all([
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $group: { _id: null, total: { $sum: "$total" } } }
        ]),
        Order.countDocuments(),
        User.countDocuments({ role: "user" }),
        Order.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select("total status createdAt shippingAddress")
          .lean()
      ]);

      const revData = revDataArr[0];

      // 3. TRENDS (These could eventually be real aggregations, keeping stubs for now)
      const revenueTrend = [
        { label: "Mon", revenue: 4000 },
        { label: "Tue", revenue: 3000 },
        { label: "Wed", revenue: 2000 },
        { label: "Thu", revenue: 2780 },
        { label: "Fri", revenue: 1890 },
        { label: "Sat", revenue: 2390 },
        { label: "Sun", revenue: 3490 },
      ];

      const ordersTrend = [
        { label: "Mon", orders: 40 },
        { label: "Tue", orders: 30 },
        { label: "Wed", orders: 20 },
        { label: "Thu", orders: 27 },
        { label: "Fri", orders: 18 },
        { label: "Sat", orders: 23 },
        { label: "Sun", orders: 34 },
      ];

      return {
        totalRevenue: revData?.total || 0,
        totalOrders,
        totalUsers,
        recentTransactions: recentTransactionsData.map(t => ({
          id: t._id,
          customer: t.shippingAddress?.fullName || t.shippingAddress?.name || "Guest",
          amount: t.total,
          status: (t.status || "placed").toUpperCase(),
          createdAt: t.createdAt
        })),
        revenueTrend,
        ordersTrend
      };
    });

    return ok(res, statsResult);
  } catch (err) {
    console.error("[ADMIN_STATS_ERROR]", err);
    return fail(res, "Failed to load dashboard statistics", 500);
  }
};

/**
 * USER LIST (PAGINATED)
 */
exports.listUsers = async (req, res) => {
    try {
        const users = await User.find({ role: { $in: ["user", "admin"] } })
            .select("name email role createdAt")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
            
        return ok(res, users);
    } catch (err) {
        return fail(res, "Failed to load users", 500);
    }
};

/**
 * UPDATE USER (ADMIN)
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Remove sensitive fields just in case
        delete updates.password;
        delete updates.role;
        
        const user = await User.findByIdAndUpdate(id, updates, { new: true }).select("-password");
        if (!user) return fail(res, "User not found", 404);
        
        return ok(res, user, "User updated successfully");
    } catch (err) {
        return fail(res, "Failed to update user", 500);
    }
};

/**
 * DEFAULT STUBS (To prevent 500 on route definition)
 */
exports.getRevenue = (req, res) => ok(res, { revenue: 0 });
exports.getOrderStats = (req, res) => ok(res, {});
exports.getCustomerStats = (req, res) => ok(res, {});
exports.getRevenueTrend = (req, res) => ok(res, []);
exports.getOrderTrend = (req, res) => ok(res, []);
exports.verifyPaymentExternal = (req, res) => ok(res, { success: true });
exports.uploadInvoiceTemplate = (req, res) => ok(res, { success: true });