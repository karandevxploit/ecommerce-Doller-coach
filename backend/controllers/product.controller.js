const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");

const Product = require("../models/product.model");
const productRepository = require("../repositories/product.repository");

const { notifyAdmins } = require("../services/notification.service");
const { sendNewProductEmail } = require("../utils/sendEmail");

const { logger } = require("../utils/logger");
const cache = require("../services/cache.service");

// ===============================
// SAFE HELPERS
// ===============================
const safeParseInt = (val, fallback, min = 1, max = 20) => {
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

  // 1. STRICT LIMIT (Compliance: Max 20)
  const limitNum = safeParseInt(limit, 20, 1, 20); // Default 20
  const pageNum = safeParseInt(page, 1, 1, 1000);

  const cacheKey = `products:${JSON.stringify(req.query)}`;

  // 2. HYBRID CACHE (DEDUPLICATED)
  if (!q) {
    return cache.getOrSet(cacheKey, async () => {
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

      const selectFields = "name price images stock category brand createdAt status isTrending featured";

      // 3. PARALLEL OPTIMIZATION (No countDocuments for speed/memory)
      const [data, total] = await Promise.all([
        Product.find(filter)
          .select(selectFields)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean()
          .maxTimeMS(3000),
        Product.estimatedDocumentCount().maxTimeMS(1000) // Fast approximation
      ]);

      const result = data.map((p) => ({
        ...p,
        id: p._id,
        title: p.name,
        image: (Array.isArray(p.images) && p.images[0]) || p.image || "/placeholder.png",
        _id: undefined,
      }));

      return { result, total };
    }, 120).then(({ result, total }) => {
      res.status(200).json({
        success: true,
        products: result,
        total,
        page: Number(pageNum),
        limit: Number(limitNum),
        totalPages: Math.ceil(total / limitNum)
      });
    }).catch(err => {
      logger.error("[PRODUCT_LIST_ERROR]", err);
      return ok(res, [], "Fallback", 200, { total: 0, page: 1, limit: 20, totalPages: 0 });
    });
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

  // Handle common string-to-number conversions for multipart/form-data
  if (typeof payload.price === 'string') sanitized.price = Number(payload.price) || 0;
  if (typeof payload.originalPrice === 'string') sanitized.originalPrice = Number(payload.originalPrice) || 0;
  if (typeof payload.stock === 'string') sanitized.stock = Number(payload.stock) || 0;
  if (typeof payload.featured === 'string') sanitized.featured = payload.featured === 'true';
  if (typeof payload.isTrending === 'string') sanitized.isTrending = payload.isTrending === 'true';

  if (payload.title || payload.name) {
    sanitized.name = (payload.name || payload.title).trim();
  }

  // Handle nested objects if they come as JSON strings from multipart
  if (typeof payload.video === 'string') {
    try { sanitized.video = JSON.parse(payload.video); } catch(e) {}
  }
  if (typeof payload.variants === 'string') {
    try { sanitized.variants = JSON.parse(payload.variants); } catch(e) {}
  }
  if (typeof payload.badge === 'string') {
    try { sanitized.badge = JSON.parse(payload.badge); } catch(e) {}
  }
  if (typeof payload.offer === 'string') {
    try { sanitized.offer = JSON.parse(payload.offer); } catch(e) {}
  }
  if (typeof payload.controls === 'string') {
    try { sanitized.controls = JSON.parse(payload.controls); } catch(e) {}
  }

  if (Array.isArray(sanitized.variants)) {
    const basePrice = sanitized.price || 0;
    sanitized.variants = sanitized.variants.map((v) => ({
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
    const sanitized = sanitizeProductData(req.body);
    const { streamUpload } = require("./upload.controller");

    // Handle Image Upload (Optional)
    if (req.files && req.files.image && req.files.image[0]) {
      const result = await streamUpload(req.files.image[0].buffer, { folder: "products/images" });
      sanitized.primaryImage = result.secure_url;
    }

    // Handle Video Upload (Optional)
    if (req.files && req.files.video && req.files.video[0]) {
      const result = await streamUpload(req.files.video[0].buffer, { 
        folder: "products/videos",
        resource_type: "video"
      });
      sanitized.video = {
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration || 0,
        size: result.bytes || req.files.video[0].size
      };
    }

    const product = new Product(sanitized);
    await product.save();

    safeCall((r) => r.flushdb());
    setImmediate(() => {
        notifyAdmins({ title: "New Product", body: product.name }).catch(() => {});
        sendNewProductEmail(product).catch(() => {});
    });

    return ok(res, product, "Product Created Successfully", 201);
  } catch (err) {
    logger.error("PRODUCT_CREATE_CRITICAL_FAIL", { error: err.message });
    return fail(res, "Creation failed: " + err.message, 500);
  }
});

// ===============================
// UPDATE PRODUCT
// ===============================
exports.updateProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return fail(res, "Not found", 404);

    const sanitized = sanitizeProductData(req.body);
    const { streamUpload } = require("./upload.controller");
    const cloudinary = require("../config/cloudinary").getCloudinary();

    // Handle Image Update
    if (req.files && req.files.image && req.files.image[0]) {
      const result = await streamUpload(req.files.image[0].buffer, { folder: "products/images" });
      sanitized.primaryImage = result.secure_url;
      // Note: We don't delete old image here unless we have its publicId, 
      // but images array usually handles this differently in this system.
    }

    // Handle Video Update
    if (req.files && req.files.video && req.files.video[0]) {
      // 1. Delete old video from Cloudinary
      if (product.video && product.video.publicId) {
        await cloudinary.uploader.destroy(product.video.publicId, { resource_type: "video" }).catch(e => {
          logger.warn("Old video deletion failed during update", { publicId: product.video.publicId });
        });
      }

      // 2. Upload new video
      const result = await streamUpload(req.files.video[0].buffer, { 
        folder: "products/videos",
        resource_type: "video"
      });
      
      sanitized.video = {
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration || 0,
        size: result.bytes || req.files.video[0].size
      };
    }

    // Apply updates
    Object.assign(product, sanitized);
    await product.save();

    safeCall((r) => r.flushdb());

    return ok(res, product, "Updated");
  } catch (err) {
    logger.error("PRODUCT_UPDATE_CRITICAL_FAIL", { error: err.message });
    return fail(res, "Update failed: " + err.message, 500);
  }
});

// ===============================
// DELETE PRODUCT VIDEO
// ===============================
exports.deleteVideo = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, "Product not found", 404);

  if (product.video && product.video.publicId) {
    try {
      const cloudinary = require("../config/cloudinary").getCloudinary();
      await cloudinary.uploader.destroy(product.video.publicId, { resource_type: "video" });
    } catch (err) {
      logger.error("CLOUDINARY_VIDEO_DELETE_FAILED", { error: err.message, publicId: product.video.publicId });
    }
  }

  product.video = { url: null, publicId: null };
  await product.save();

  safeCall((r) => r.flushdb());

  return ok(res, product, "Video deleted successfully");
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