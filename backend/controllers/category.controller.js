const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Category = require("../models/category.model");
const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");

const ALLOWED_GENDERS = new Set(["men", "women"]);
const ALLOWED_TYPES = new Set(["top", "bottom", "other"]);

const clean = (value = "") => String(value ?? "").trim();
const normalizeLower = (value = "") => clean(value).toLowerCase();
const toBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "active"].includes(normalizeLower(value));
};
const makeSlug = (value = "") =>
  normalizeLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeSizes = (sizes) => {
  const values = Array.isArray(sizes)
    ? sizes
    : String(sizes || "")
        .split(",");

  return [...new Set(values.map((size) => clean(size).toUpperCase()).filter(Boolean))];
};

const normalizeCategoryPayload = (body = {}, { partial = false } = {}) => {
  const payload = {};

  if (!partial || body.name !== undefined) {
    payload.name = clean(body.name);
    if (!payload.name) throw new Error("Category name is required");
    payload.slug = makeSlug(payload.name);
    if (!payload.slug) throw new Error("Category name is invalid");
  }

  if (!partial || body.gender !== undefined) {
    payload.gender = normalizeLower(body.gender);
    if (!ALLOWED_GENDERS.has(payload.gender)) throw new Error("Gender must be men or women");
  }

  if (!partial || body.type !== undefined) {
    payload.type = normalizeLower(body.type);
    if (!ALLOWED_TYPES.has(payload.type)) throw new Error("Type must be top, bottom, or other");
  }

  if (!partial || body.sizes !== undefined) {
    payload.sizes = normalizeSizes(body.sizes);
    if (!payload.sizes.length) throw new Error("At least one size is required");
  }

  if (body.description !== undefined) payload.description = clean(body.description);
  if (body.image !== undefined) payload.image = clean(body.image);
  if (body.isActive !== undefined) payload.isActive = toBool(body.isActive);

  return payload;
};

const handleDuplicate = (err, res) => {
  if (err?.code !== 11000) return false;
  const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "category";
  fail(res, `Category ${field} already exists`, 409);
  return true;
};

const ensureObjectId = (id, res) => {
  if (mongoose.Types.ObjectId.isValid(id)) return true;
  fail(res, "Invalid category id", 400);
  return false;
};

const invalidateFilterCaches = async () => {
  await safeCall(async (r) => {
    let cursor = "0";
    do {
      const [next, keys] = await r.scan(cursor, "MATCH", "filters:*", "COUNT", 200);
      cursor = next;
      if (keys.length) await r.del(...keys);
    } while (cursor !== "0");
  });
};

exports.listCategories = asyncHandler(async (req, res) => {
  const gender = normalizeLower(req.query.gender);
  const type = normalizeLower(req.query.type);
  const includeInactive = ["1", "true", "yes"].includes(normalizeLower(req.query.includeInactive));
  const filter = { isActive: true };

  if (includeInactive && req.user?.role === "admin") delete filter.isActive;
  if (gender) {
    if (!ALLOWED_GENDERS.has(gender)) return fail(res, "Invalid gender filter", 400);
    filter.gender = gender;
  }
  if (type) {
    if (!ALLOWED_TYPES.has(type)) return fail(res, "Invalid type filter", 400);
    filter.type = type;
  }

  const categories = await Category.find(filter)
    .sort({ gender: 1, type: 1, name: 1 })
    .lean();

  return ok(res, categories);
});

exports.createCategory = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = normalizeCategoryPayload(req.body);
  } catch (err) {
    return fail(res, err.message, 400);
  }

  let category;
  try {
    category = await Category.create(payload);
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    throw err;
  }

  setImmediate(() => {
    invalidateFilterCaches().catch(() => {});
  });

  return ok(res, category, "Category Created", 201);
});

exports.updateCategory = asyncHandler(async (req, res) => {
  if (!ensureObjectId(req.params.id, res)) return;

  let payload;
  try {
    payload = normalizeCategoryPayload(req.body, { partial: true });
  } catch (err) {
    return fail(res, err.message, 400);
  }

  let category;
  try {
    category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).lean();
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    throw err;
  }

  if (!category) return fail(res, "Category not found", 404);

  setImmediate(() => {
    invalidateFilterCaches().catch(() => {});
  });

  return ok(res, category, "Category Updated");
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  if (!ensureObjectId(req.params.id, res)) return;

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  ).lean();

  if (!category) return fail(res, "Category not found", 404);

  setImmediate(() => {
    invalidateFilterCaches().catch(() => {});
  });

  return ok(res, category, "Category Deleted");
});
