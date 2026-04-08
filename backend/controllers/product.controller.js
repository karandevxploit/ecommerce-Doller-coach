const asyncHandler = require("express-async-handler");
const { ok, fail } = require("../utils/apiResponse");
const Product = require("../models/product.model");
const productRepository = require("../repositories/product.repository");
const paginate = require("../utils/pagination");
const { notifyAdmins } = require("../services/notification.service");
const { sendNewProductEmail } = require("../utils/sendEmail");
const logger = require("../utils/logger");

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.listProducts = asyncHandler(async (req, res) => {
  const { category, subcategory, productType, type, sizes, topSizes, bottomSizes, q, featured, trending } = req.query;
  
  const filter = {};
  if (category && category !== "All") filter.category = category.toUpperCase();
  if (subcategory && subcategory !== "All") filter.subcategory = subcategory;
  if (productType && productType !== "All") filter.productType = productType;
  if (type && type !== "All") filter.type = type.toUpperCase();
  if (featured === "true") filter.featured = true;
  if (trending === "true") filter.trending = true;
  
  if (sizes && sizes !== "All") {
    filter.sizes = { $in: String(sizes).split(",") };
  }
  if (topSizes && topSizes !== "All") {
    filter.topSizes = { $in: String(topSizes).split(",") };
  }
  if (bottomSizes && bottomSizes !== "All") {
    filter.bottomSizes = { $in: String(bottomSizes).split(",") };
  }

  if (q) {
    const trimmed = String(q).trim().slice(0, 100);
    if (trimmed) {
      filter.$or = [
        { title: { $regex: escapeRegex(trimmed), $options: "i" } },
        { brand: { $regex: escapeRegex(trimmed), $options: "i" } },
        { description: { $regex: escapeRegex(trimmed), $options: "i" } },
      ];
    }
  }
  
  const result = await paginate(Product, filter, req.query);
  return ok(res, result.data, "Products fetched", 200, result.pagination);
});

exports.getProduct = asyncHandler(async (req, res) => {
  const product = await productRepository.findById(req.params.id);
  if (!product) return fail(res, "Product not found", 404);
  return ok(res, product);
});

exports.createProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  
  // Basic validation
  if (!payload.title || !payload.category || !payload.price) {
    return fail(res, "Title, category and price are required", 400);
  }

  const product = await productRepository.create({
    ...payload,
    category: payload.category.toUpperCase(),
    type: (payload.type || "TOPWEAR").toUpperCase(),
    images: req.file ? [req.file.path] : (payload.images || []),
  });

  // Async notifications
  notifyAdmins({ title: "New Product", body: product.title, type: "product" }).catch(e => logger.error(e));
  sendNewProductEmail(product).catch(e => logger.error(e));

  return ok(res, product, "Product created", 201);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await productRepository.updateById(req.params.id, req.body);
  if (!product) return fail(res, "Product not found", 404);
  return ok(res, product, "Product updated");
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await productRepository.deleteById(req.params.id);
  if (!product) return fail(res, "Product not found", 404);
  return ok(res, { deleted: true }, "Product deleted");
});
