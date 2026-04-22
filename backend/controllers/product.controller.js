const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");

const Product = require("../models/product.model");
const productRepository = require("../repositories/product.repository");

const { notifyAdmins } = require("../services/notification.service");
const { sendNewProductEmail } = require("../utils/sendEmail");

const { logger } = require("../utils/logger");
const { safeCall } = require("../config/redis");

// ===============================
// SAFE HELPERS
// ===============================
const safeParseInt = (val, fallback, min = 1, max = 50) => {
  const n = parseInt(val);
  if (isNaN(n) || n < min) return fallback;
  return Math.min(n, max);
};

const escapeRegex = (input) =>
  String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ===============================
// LIST PRODUCTS (HIGH SCALE)
// ===============================
exports.listProducts = asyncHandler(async (req, res) => {
  const {
    category,
    subcategory,
    productType,
    type,
    sizes,
    q,
    featured,
    trending,
    limit,
    page,
  } = req.query;

  const limitNum = safeParseInt(limit, 10);
  const pageNum = safeParseInt(page, 1, 1, 1000);

  const cacheKey = `products:${JSON.stringify(req.query)}`;

  // 🔥 CACHE FIRST (SAFE)
  if (!q) {
    const cached = await safeCall((r) => r.get(cacheKey));
    if (cached) {
      const { result, total } = JSON.parse(cached);
      return ok(res, result, "Products (cache)", 200, {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }
  }

  // FILTER
  const filter = { isDeleted: { $ne: true } };

  if (category && category !== "All") filter.category = category.toUpperCase();
  if (subcategory && subcategory !== "All") filter.subcategory = subcategory;
  if (productType && productType !== "All") filter.productType = productType;
  if (type && type !== "All") filter.type = type.toUpperCase();
  if (featured === "true") filter.featured = true;
  if (trending === "true") filter.trending = true;

  if (sizes) {
    const arr = sizes.split(",").map((s) => s.trim());
    if (arr.length) filter.sizes = { $in: arr };
  }

  // SEARCH (LIMITED SAFE)
  if (q) {
    const search = escapeRegex(q.slice(0, 50));
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  try {
    const selectFields = "name price images stock category brand createdAt status isTrending featured";

    const total = await Product.countDocuments(filter);
    const data = await Product.find(filter)
      .select(selectFields)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()
      .maxTimeMS(5000);

    const result = data.map((p) => ({
      ...p,
      id: p._id,
      title: p.name, // Maintain UI compatibility
      _id: undefined,
    }));

    // 🔥 CACHE WRITE (ASYNC SAFE)
    if (!q) {
      safeCall((r) =>
        r.set(cacheKey, JSON.stringify({ result, total }), "EX", 300)
      );
    }

    return ok(res, result, "Products fetched", 200, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    logger.error("[PRODUCT_LIST_ERROR]", err);
    return ok(res, [], "Fallback result", 200, { total: 0, page: 1, limit: 10, totalPages: 0 });
  }
});

// ===============================
// GET SINGLE PRODUCT
// ===============================
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await productRepository.findById(req.params.id);
  if (!product) return fail(res, "Not found", 404);

  return ok(res, product);
});

// ===============================
// DATA SANITIZER HELPER
// ===============================
const sanitizeProductData = (payload) => {
  if (!payload || typeof payload !== 'object') return {};
  
  const sanitized = { ...payload };

  if (payload.title || payload.name) {
    sanitized.name = (payload.name || payload.title).trim();
  }

  if (payload.price !== undefined) {
    sanitized.price = Number(payload.price) || 0;
  }

  if (payload.originalPrice !== undefined) {
    sanitized.originalPrice = Number(payload.originalPrice) || sanitized.price || 0;
  }

  if (payload.isTrending === undefined && payload.trending !== undefined) {
    sanitized.isTrending = !!payload.trending;
  }

  // Only transform variants if they are explicitly provided
  if (Array.isArray(payload.variants)) {
    const basePrice = sanitized.price || 0;
    sanitized.variants = payload.variants.map((v) => ({
      ...v,
      sku: v.sku || `${(sanitized.name || "PRD").substring(0, 3).toUpperCase()}-${(v.color || 'XX').substring(0, 2).toUpperCase()}-${v.size || 'S'}-${Date.now()}`,
      color: String(v.color || "Common"),
      size: String(v.size || "Standard"),
      price: Number(v.price || basePrice) || 0,
      stock: Number(v.stock >= 0 ? v.stock : 0),
      image: String(v.image || "")
    }));
    sanitized.stock = sanitized.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }

  return sanitized;
};

// ===============================
// CREATE PRODUCT (SAFE)
// ===============================
exports.createProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  try {
    const product = new Product(req.body);
    await product.save();

    // ASYNC NOTIFICATIONS & CACHE
    safeCall((r) => r.flushdb());
    setImmediate(() => {
        notifyAdmins({ title: "New Product", body: product.name }).catch(() => {});
        sendNewProductEmail(product).catch(() => {});
    });

    return ok(res, product, "Product Created Successfully", 201);
  } catch (err) {
    logger.error("PRODUCT_CREATE_CRITICAL_FAIL", { 
        error: err.message, 
        body: req.body 
    });

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return fail(res, "Validation: " + messages.join(", "), 400);
    }
    
    if (err.code === 11000) {
      return fail(res, `Conflict: A resource with this value already exists.`, 409);
    }

    return fail(res, "Database error: " + err.message, 500);
  }
});

// ===============================
// UPDATE PRODUCT
// ===============================
exports.updateProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const sanitized = sanitizeProductData(req.body);

  const product = await productRepository.updateById(
    req.params.id,
    sanitized
  );

  if (!product) return fail(res, "Not found", 404);

  safeCall((r) => r.flushdb());

  return ok(res, product, "Updated");
});

// ===============================
// DELETE PRODUCT
// ===============================
exports.deleteProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const product = await productRepository.hardDeleteById(req.params.id);
  if (!product) return fail(res, "Not found", 404);

  safeCall((r) => r.flushdb());

  return ok(res, { deleted: true }, "Product physically removed from catalog");
});

// ===============================
// GET FILTERS (OPTIMIZED)
// ===============================
exports.getFilters = asyncHandler(async (req, res) => {
  try {
    const filters = await Product.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          categories: { $addToSet: "$category" },
          subcategories: { $addToSet: "$subcategory" },
          types: { $addToSet: "$type" },
          maxPrice: { $max: "$price" },
          minPrice: { $min: "$price" },
        },
      },
    ]);

    const data = filters[0] || {
      categories: [],
      subcategories: [],
      types: [],
      maxPrice: 10000,
      minPrice: 0,
    };

    return ok(res, data, "Filters fetched");
  } catch (err) {
    logger.error("[GET_FILTERS_ERROR]", err);
    return fail(res, "Failed to load filters", 500);
  }
});