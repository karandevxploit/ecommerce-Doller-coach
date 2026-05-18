const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");

const Product = require("../models/product.model");
const Category = require("../models/category.model");
const User = require("../models/user.model");
const productRepository = require("../repositories/product.repository");

const { notifyAdmins } = require("../services/notification.service");
const { sendNewProductAnnouncementEmail, sendNewProductEmail } = require("../utils/sendEmail");
const { logger } = require("../utils/logger");
const cache = require("../services/cache.service");
const { safeCall } = require("../config/redis");

// ===============================
// SAFE HELPERS
// ===============================
const safeParseInt = (val, fallback, min = 1, max = 20) => {
  const n = parseInt(val);
  if (isNaN(n) || n < min) return fallback;
  return Math.min(n, max);
};

const clean = (value = "") => String(value ?? "").trim();
const toBool = (value) => value === true || value === "true" || value === 1 || value === "1";
const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ""));
const splitList = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return String(value).split(",").map(clean).filter(Boolean);
};
const DEFAULT_PRODUCT_IMAGE = "/uploads/products/default-product.webp";

const makeSlug = (name = "") =>
  clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const makeUniqueSlug = async (name = "", excludeId = null) => {
  const baseSlug = makeSlug(name) || `product-${Date.now()}`;
  const query = (slug) => {
    const condition = { slug };
    if (excludeId && isObjectId(excludeId)) condition._id = { $ne: excludeId };
    return condition;
  };

  const existing = await Product.findOne(query(baseSlug)).select("_id").lean();
  if (!existing) return baseSlug;

  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const nextSlug = `${baseSlug}-${suffix}`;
    const duplicate = await Product.findOne(query(nextSlug)).select("_id").lean();
    if (!duplicate) return nextSlug;
  }

  return `${baseSlug}-${Date.now()}`;
};

const escapeRegex = (input) =>
  String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isUsableImage = (value) => {
  const image = clean(value);
  return Boolean(
    image &&
    (
      image.startsWith("http://") ||
      image.startsWith("https://") ||
      image.startsWith("data:image/") ||
      image.startsWith("blob:") ||
      image.startsWith("/uploads/") ||
      image.startsWith("uploads/")
    )
  );
};

const stripLocalUploadHost = (value) => {
  const image = clean(value);
  if (!image) return "";

  try {
    const parsed = new URL(image);
    const isLocalHost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";

    if (isLocalHost && parsed.pathname.startsWith("/uploads/")) {
      return `${parsed.pathname}${parsed.search || ""}`;
    }
  } catch {
    // Keep non-absolute upload paths as they are.
  }

  return image;
};

const normalizePersistedImages = (value) => splitList(value).filter(isUsableImage);

const collectProductImages = (product = {}) => {
  const images = [
    product.primaryImage,
    product.image,
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.variants)
      ? product.variants.flatMap((variant) =>
        Array.isArray(variant?.images) ? variant.images : []
      )
      : []),
  ].map(stripLocalUploadHost).filter(isUsableImage);

  const uniqueImages = [...new Set(images)];
  return uniqueImages.length ? uniqueImages : [DEFAULT_PRODUCT_IMAGE];
};

const serializeProduct = (product = {}) => {
  const images = collectProductImages(product);

  return {
    ...product,
    id: String(product._id || product.id || ""),
    title: product.title || product.name || "",
    images,
    primaryImage: images[0] || "",
    image: images[0] || "",
    stock: Number(product.stock) || 0,
  };
};

const invalidateProductCaches = async () => {
  await Promise.allSettled([
    cache.del("offers:active"),
    safeCall(async (r) => {
      let cursor = "0";
      do {
        const [next, keys] = await r.scan(cursor, "MATCH", "products*", "COUNT", 200);
        cursor = next;
        if (keys.length) await r.del(...keys);
      } while (cursor !== "0");
    }),
    safeCall(async (r) => {
      let cursor = "0";
      do {
        const [next, keys] = await r.scan(cursor, "MATCH", "filters:*", "COUNT", 200);
        cursor = next;
        if (keys.length) await r.del(...keys);
      } while (cursor !== "0");
    }),
    safeCall(async (r) => {
      let cursor = "0";
      do {
        const [next, keys] = await r.scan(cursor, "MATCH", "cache:*:GET:/api/products*:*", "COUNT", 200);
        cursor = next;
        if (keys.length) await r.del(...keys);
      } while (cursor !== "0");
    }),
  ]);
};

const notifyUsersAboutNewProduct = async (product) => {
  const productData = product?.toObject ? product.toObject() : product;
  const productStatus = String(productData?.status || "").toLowerCase();

  if (productStatus !== "active") {
    logger.info("[NEW_PRODUCT_EMAIL_SKIPPED]", {
      productId: String(productData?._id || ""),
      reason: "product_not_active",
    });
    return;
  }

  const users = await User.find({
    role: "user",
    isDeleted: { $ne: true },
    email: { $exists: true, $ne: "" },
  })
    .select("email")
    .lean();

  const emails = [...new Set(users.map((user) => String(user.email || "").trim().toLowerCase()).filter(Boolean))];
  const batchSize = 80;

  for (let index = 0; index < emails.length; index += batchSize) {
    const batch = emails.slice(index, index + batchSize);
    await sendNewProductAnnouncementEmail({
      product: productData,
      recipients: batch,
    });
  }

  logger.info("[NEW_PRODUCT_EMAIL_SENT]", {
    productId: String(productData?._id || ""),
    recipients: emails.length,
  });
};

// ===============================
// LIST PRODUCTS (HIGH SCALE)
// ===============================
exports.listProducts = asyncHandler(async (req, res) => {
  try {
    // 1. SANITIZE QUERY PARAMETERS
    const {
      category,
      gender,
      color,
      colors,
      size,
      sizes,
      minPrice,
      maxPrice,
      rating,
      availability,
      sort = "newest",
      q,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = safeParseInt(page, 1, 1, 100000);
    const limitNum = safeParseInt(limit, 20, 1, 60);
    const activeColor = color || colors;
    const activeSize = size || sizes;

    // 2. FIX CACHE KEY (REMOVE undefined)
    const cacheKey = `products_v7:cat:${category || "all"}:gen:${gender || "all"}:col:${activeColor || "all"}:siz:${activeSize || "all"}:pr:${minPrice || 0}-${maxPrice || "max"}:rt:${rating || 0}:av:${availability || "all"}:sort:${sort}:q:${q || ""}:p:${pageNum}:l:${limitNum}`;

    return cache.getOrSet(cacheKey, async () => {
      // 3. BUILD QUERY DYNAMICALLY
      const query = { 
        isDeleted: { $ne: true }, 
        status: "active"
      };

      // Handle Categories (Single or Multi)
      if (category) {
        const catArr = Array.isArray(category) ? category : category.split(",");
        const validIds = catArr.filter(id => /^[0-9a-fA-F]{24}$/.test(id));
        if (validIds.length > 0) {
          query.category = validIds.length === 1 ? validIds[0] : { $in: validIds };
        } else {
          const categoryText = String(category).trim().toLowerCase();
          if (["men", "women"].includes(categoryText)) {
            query.gender = categoryText;
          } else if (!["all", "none", "collection"].includes(categoryText)) {
            const matchingCategories = await Category.find({
              isActive: true,
              $or: [
                { name: new RegExp(`^${escapeRegex(categoryText)}$`, "i") },
                { slug: categoryText },
              ],
            }).select("_id").lean();

            if (matchingCategories.length) {
              query.category = { $in: matchingCategories.map((cat) => cat._id) };
            } else {
              query._id = { $exists: false };
            }
          }
        }
      }
      if (gender && !["All", "all", "collection"].includes(gender)) {
        const genderText = String(gender).toLowerCase();

        if (!category) {
          const genderCategories = await Category.find({
            gender: genderText,
            isActive: true,
          }).select("_id").lean();
          const genderCategoryIds = genderCategories.map((cat) => String(cat._id || cat.id)).filter(Boolean);

          query.$or = [
            { gender: genderText },
            { gender: { $exists: false } },
            { gender: "" },
            ...(genderCategoryIds.length ? [{ category: { $in: genderCategoryIds } }] : []),
          ];
        } else {
          query.$or = [
            { gender: genderText },
            { gender: { $exists: false } },
            { gender: "" },
          ];
        }
      }

      // Handle Multi-Select (Color)
      if (activeColor) {
        const colorArr = Array.isArray(activeColor) ? activeColor : activeColor.split(",");
        query.colors = { $in: colorArr.filter(Boolean) };
      }

      // Handle Multi-Select (Size)
      if (activeSize) {
        const sizeArr = Array.isArray(activeSize) ? activeSize : activeSize.split(",");
        query.sizes = { $in: sizeArr.filter(Boolean) };
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      if (rating) {
        query.rating = { $gte: Number(rating) };
      }

      if (availability === "in_stock") {
        query.stock = { $gt: 0 };
      } else if (availability === "out_of_stock") {
        query.stock = { $lte: 0 };
      }

      if (q && String(q).trim()) {
        const searchRegex = new RegExp(escapeRegex(String(q).trim()), "i");
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { tags: searchRegex },
        ];
      }

      let sortQuery = { createdAt: -1 };
      if (sort === "price-asc") sortQuery = { price: 1, createdAt: -1 };
      else if (sort === "price-desc") sortQuery = { price: -1, createdAt: -1 };
      else if (sort === "popular") sortQuery = { salesCount: -1, rating: -1, createdAt: -1 };
      else if (sort === "trending") sortQuery = { isTrending: -1, createdAt: -1 };

      // 4. SAFE QUERY EXECUTION
      const [data, total] = await Promise.all([
        Product.find(query)
          .select("name title price originalPrice images primaryImage hoverImage variants category colors sizes gender stock status createdAt offer video rating ratings salesCount")
          .sort(sortQuery)
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .populate("category", "name")
          .lean(),
        Product.countDocuments(query)
      ]);

      const result = data.map(serializeProduct);

      return { 
        products: result, 
        total, 
        page: pageNum, 
        limit: limitNum, 
        totalPages: Math.ceil(total / limitNum) 
      };
    }, 60).then((payload) => {
      return ok(res, payload, "Products fetched");
    });
  } catch (error) {
    // 5. IMPROVE ERROR LOGGING
    logger.error("[PRODUCT_LIST_ERROR]", { message: error.message });
    return fail(res, "Failed to fetch products", 500);
  }
});

// ===============================
// GET SINGLE PRODUCT
// ===============================
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await productRepository.findById(req.params.id, "", "category");
  if (!product || product.isDeleted) {
    return fail(res, "Product not found", 404);
  }
  if (product.status !== "active" && req.user?.role !== "admin") {
    return fail(res, "Product not found", 404);
  }

  // Ensure consistent response structure
  return ok(res, serializeProduct(product), "Product retrieved successfully");
});

// ===============================
// DATA SANITIZER HELPER
// ===============================
const sanitizeProductData = (payload) => {
  if (!payload || typeof payload !== 'object') return {};
  
  const sanitized = { ...payload };

  // Handle common string-to-number conversions
  if (payload.price !== undefined) sanitized.price = Number(payload.price);
  if (payload.originalPrice !== undefined) sanitized.originalPrice = Number(payload.originalPrice) || 0;
  delete sanitized.rating;
  delete sanitized.ratings;
  
  // Booleans
  if (payload.featured !== undefined) sanitized.featured = toBool(payload.featured);
  if (payload.isTrending !== undefined || payload.trending !== undefined) sanitized.isTrending = toBool(payload.isTrending ?? payload.trending);
  if (payload.isBestSeller !== undefined) sanitized.isBestSeller = toBool(payload.isBestSeller);

  if (payload.gender) sanitized.gender = String(payload.gender).toLowerCase();
  
  if (payload.title || payload.name) {
    sanitized.name = clean(payload.name || payload.title);
    delete sanitized.slug;
  }

  if (payload.category !== undefined) sanitized.category = clean(payload.category);
  if (payload.subcategory !== undefined) sanitized.subcategory = clean(payload.subcategory).toLowerCase();
  if (payload.status !== undefined) sanitized.status = clean(payload.status).toLowerCase() || "draft";
  if (payload.images !== undefined) sanitized.images = normalizePersistedImages(payload.images);
  if (payload.colors !== undefined) sanitized.colors = splitList(payload.colors);
  if (payload.sizes !== undefined) sanitized.sizes = splitList(payload.sizes);
  if (payload.primaryImage !== undefined) {
    sanitized.primaryImage = isUsableImage(payload.primaryImage) ? clean(payload.primaryImage) : "";
  }
  if (payload.hoverImage !== undefined) {
    sanitized.hoverImage = isUsableImage(payload.hoverImage) ? clean(payload.hoverImage) : "";
  }

  // Handle Video
  if (payload.video !== undefined) {
    sanitized.video = typeof payload.video === 'object' ? (payload.video.url || "") : String(payload.video);
  }

  if (payload.offer && typeof payload.offer === "object") {
    sanitized.offer = {
      title: clean(payload.offer.title),
      discount: clean(payload.offer.discount),
      couponCode: clean(payload.offer.couponCode).toUpperCase(),
      startDate: payload.offer.startDate || null,
      expiryDate: payload.offer.expiryDate || payload.offer.endDate || null,
      isActive: toBool(payload.offer.isActive ?? payload.offer.enabled),
    };
  }

  // Handle Variants (Hierarchical)
  if (Array.isArray(sanitized.variants)) {
    let totalStock = 0;
    sanitized.variants = sanitized.variants.map((v) => {
      const sizes = Array.isArray(v.sizes) ? v.sizes.map(s => ({
        size: String(s.size),
        stock: Number(s.stock) || 0
      })) : [];
      
      totalStock += sizes.reduce((sum, s) => sum + s.stock, 0);

      return {
        color: String(v.color || "Common"),
        colorCode: String(v.colorCode || "#000000"),
        images: normalizePersistedImages(v.images),
        sizes: sizes
      };
    });
    sanitized.stock = totalStock;
    sanitized.colors = [...new Set(sanitized.variants.map((v) => v.color).filter(Boolean))];
    sanitized.sizes = [...new Set(sanitized.variants.flatMap((v) => v.sizes.map((s) => s.size)).filter(Boolean))];
  } else if (payload.stock !== undefined) {
    sanitized.stock = Math.max(0, Number(payload.stock) || 0);
  }

  delete sanitized.title;
  delete sanitized.trending;
  delete sanitized.productType;
  delete sanitized.badge;
  delete sanitized.controls;

  return sanitized;
};

const validateProductPayload = async (payload, { partial = false } = {}) => {
  if (!partial || payload.name !== undefined) {
    if (!payload.name || payload.name.length < 2) return "Product name is required";
  }
  if (!partial || payload.price !== undefined) {
    if (!Number.isFinite(Number(payload.price)) || Number(payload.price) <= 0) return "Valid price is required";
  }
  if (!partial || payload.category !== undefined) {
    if (!isObjectId(payload.category)) return "Valid category is required";
    const exists = await Category.exists({ _id: payload.category, isActive: true });
    if (!exists) return "Category not found";
  }
  if (payload.originalPrice && payload.price && Number(payload.originalPrice) < Number(payload.price)) {
    return "Original price cannot be less than price";
  }
  return null;
};

// ===============================
// ADMIN LIST PRODUCTS
// ===============================
exports.adminListProducts = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const { status, page = 1, limit = 50, q, gender, category } = req.query;
  const pageNum = safeParseInt(page, 1, 1, 100000);
  const limitNum = safeParseInt(limit, 50, 1, 100);

  // 1. BASE QUERY
  const query = { isDeleted: { $ne: true } };
  
  // 2. STATUS FILTER
  if (status && status !== "all") query.status = status;

  const genderText =
    gender && !["all", "All"].includes(gender)
      ? String(gender).toLowerCase()
      : "";
  const categoryText =
    category && !["all", "All"].includes(category)
      ? String(category)
      : "";

  if (genderText) query.gender = genderText;

  if (categoryText) {
    query.category = categoryText;

    if (genderText) {
      const selectedCategory = await Category.findById(categoryText)
        .select("gender")
        .lean();

      if (
        selectedCategory?.gender &&
        String(selectedCategory.gender).toLowerCase() !== genderText
      ) {
        query._id = { $exists: false };
      }
    }
  }

  // 3. SEARCH FILTER
  if (q && String(q).trim()) {
    const searchRegex = new RegExp(escapeRegex(String(q).trim()), "i");
    query.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { subcategory: searchRegex }
    ];
  }

  const options = {
    page: pageNum,
    limit: limitNum,
    populate: "category",
    sort: { createdAt: -1 },
    lean: true
  };

  const products = await Product.paginate(query, options);
  
  const docs = products.docs.map(serializeProduct);

  return ok(res, {
    products: docs,
    items: docs,
    total: products.totalDocs,
    pages: products.totalPages,
    totalPages: products.totalPages,
    currentPage: products.page
  }, "Admin products fetched");
});

// ===============================
// TOGGLE PRODUCT STATUS
// ===============================
exports.toggleProductStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const { id } = req.params;
  const product = await Product.findById(id);

  if (!product) return fail(res, "Product not found", 404);

  // Toggle draft <-> active
  product.status = product.status === "active" ? "draft" : "active";
  await product.save();

  setImmediate(() => {
    invalidateProductCaches().catch(() => {});
  });

  return ok(res, product, `Product status updated to ${product.status}`);
});

// ===============================
// CREATE PRODUCT (SAFE)
// ===============================
// ===============================
// CREATE PRODUCT (SAFE)
// ===============================
exports.createProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const sanitized = sanitizeProductData(req.body);
  const validationError = await validateProductPayload(sanitized);
  if (validationError) return fail(res, validationError, 400);
  if (sanitized.name) {
    sanitized.slug = await makeUniqueSlug(sanitized.name);
  }

  const product = new Product(sanitized);
  await product.save();

  // Background Tasks
  setImmediate(() => {
    invalidateProductCaches().catch(() => {});
    notifyAdmins({ title: "New Product", body: product.name }).catch(() => {});
    sendNewProductEmail(product.toObject()).catch((error) => {
      logger.error("[NEW_PRODUCT_ADMIN_EMAIL_FAILED]", { error: error.message });
    });
    notifyUsersAboutNewProduct(product).catch((error) => {
      logger.error("[NEW_PRODUCT_USER_EMAIL_FAILED]", { error: error.message });
    });
  });

  return res.status(201).json({ 
    success: true, 
    data: serializeProduct(product.toObject()), 
    message: "Product created successfully" 
  });
});

// ===============================
// UPDATE PRODUCT
// ===============================
exports.updateProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const { id } = req.params;
  const sanitized = sanitizeProductData(req.body);
  const validationError = await validateProductPayload(sanitized, { partial: true });
  if (validationError) return fail(res, validationError, 400);

  const product = await Product.findById(id);
  if (!product) return fail(res, "Product not found", 404);
  if (sanitized.name) {
    sanitized.slug = await makeUniqueSlug(sanitized.name, id);
  }
  Object.assign(product, sanitized);
  await product.save();

  // Background Tasks
  setImmediate(() => {
    invalidateProductCaches().catch(() => {});
  });

  return ok(res, serializeProduct(product.toObject()), "Product updated successfully");
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

  product.video = "";
  await product.save();

  setImmediate(() => {
    invalidateProductCaches().catch(() => {});
  });

  return ok(res, product, "Video deleted successfully");
});

// ===============================
// DELETE PRODUCT (SOFT DELETE)
// ===============================
exports.deleteProduct = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return fail(res, "Unauthorized", 403);
  }

  const product = await Product.findByIdAndUpdate(req.params.id, {
    isDeleted: true,
    status: "archived"
  }, { new: true });

  if (!product) return fail(res, "Not found", 404);

  setImmediate(() => {
    invalidateProductCaches().catch(() => {});
  });

  return ok(res, { deleted: true }, "Product securely archived and removed from catalog");
});

// ===============================
// SPECIALIZED SECTIONS (HOME)
// ===============================
exports.getNewArrivals = asyncHandler(async (req, res) => {
  const products = await Product.find({ 
    isDeleted: { $ne: true }, 
    status: "active"
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("category")
    .lean();
    
  res.json({ success: true, data: { products: products.map(serializeProduct) }, products: products.map(serializeProduct) });
});

exports.getHotSale = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isDeleted: { $ne: true },
    status: "active"
  })
    .sort({ price: 1, createdAt: -1 })
    .limit(40)
    .populate("category")
    .lean();

  const hotProducts = products
    .map(serializeProduct)
    .map((product) => {
      const price = Number(product.price) || 0;
      const originalPrice = Number(product.originalPrice) || 0;
      const discount =
        originalPrice > price && originalPrice > 0
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

      return { ...product, discount };
    })
    .filter((product) => product.price <= 50 || product.discount >= 50)
    .sort((a, b) => (b.discount - a.discount) || (a.price - b.price))
    .slice(0, 8);

  res.json({ success: true, data: { products: hotProducts }, products: hotProducts });
});

exports.getTrending = asyncHandler(async (req, res) => {
  const products = await Product.find({ 
    isDeleted: { $ne: true }, 
    status: "active"
  })
    .sort({ salesCount: -1, "ratings.average": -1, "ratings.count": -1, createdAt: -1 })
    .limit(8)
    .populate("category")
    .lean();
    
  res.json({ success: true, data: { products: products.map(serializeProduct) }, products: products.map(serializeProduct) });
});

exports.getBestSellers = asyncHandler(async (req, res) => {
  const products = await Product.find({ 
    isDeleted: { $ne: true }, 
    status: "active"
  })
    .sort({ salesCount: -1 })
    .limit(8)
    .populate("category")
    .lean();
    
  res.json({ success: true, data: { products: products.map(serializeProduct) }, products: products.map(serializeProduct) });
});

// ===============================
// GET FILTERS (OPTIMIZED)
// ===============================
exports.getFilters = asyncHandler(async (req, res) => {
  const { gender, categoryId } = req.query;
  const cacheKey = `filters:${gender || 'all'}:${categoryId || 'none'}`;
  
  return cache.getOrSet(cacheKey, async () => {
    const genderFilter = gender && gender !== "all" ? gender : "men";
    const filter = { isDeleted: { $ne: true }, status: "active", gender: genderFilter };

    const [categories, colors, priceStats] = await Promise.all([
      Category.find({ gender: genderFilter, isActive: true }).lean(),
      Product.distinct("colors", { gender: genderFilter, isDeleted: { $ne: true }, status: "active" }),
      Product.aggregate([
        { $match: { gender: genderFilter, isDeleted: { $ne: true }, status: "active" } },
        { $group: { _id: null, maxPrice: { $max: "$price" } } }
      ])
    ]);

    // Handle sizes
    let sizes = [];
    if (categoryId && !["all", "none", "null", "undefined"].includes(categoryId)) {
      const catIds = String(categoryId).split(",").filter(id => /^[0-9a-fA-F]{24}$/.test(id));
      if (catIds.length > 0) {
        const selectedCats = await Category.find({ _id: { $in: catIds } }).lean();
        
        const unionSizes = new Set();
        selectedCats.forEach(cat => {
          (cat.sizes || []).forEach(s => unionSizes.add(s));
        });
        sizes = Array.from(unionSizes);
      }
    } else {
      // Union of all sizes in this gender
      sizes = await Product.distinct("sizes", { gender: genderFilter, isDeleted: { $ne: true }, status: "active" });
    }

    const stats = priceStats[0] || { maxPrice: 10000 };

    return {
      categories: categories.map(c => ({
        _id: c._id,
        name: c.name,
        gender: c.gender,
        type: c.type,
        sizes: c.sizes
      })),
      colors: colors.filter(Boolean),
      sizes: sizes.filter(Boolean),
      maxPrice: stats.maxPrice || 10000,
    };
  }, 300).then((data) => {
    return ok(res, data, "Dynamic Filters Fetched");
  }).catch(err => {
    logger.error("[GET_FILTERS_ERROR]", err);
    return fail(res, "Failed to load filters", 500);
  });
});
