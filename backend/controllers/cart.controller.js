const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const { ok, fail } = require("../utils/apiResponse");

const MAX_ITEM_QTY = 20;

const getUserId = (req) => req.user?._id || req.user?.id;
const clean = (value = "") => String(value ?? "").trim();
const sameText = (left, right) => clean(left).toLowerCase() === clean(right).toLowerCase();
const parseQty = (value, fallback = 1) => {
  const qty = Number(value);
  return Number.isInteger(qty) && qty > 0 ? qty : fallback;
};

const buildVariantKey = ({ productId, size = "", topSize = "", bottomSize = "", color = "", variantIdx = "" }) => [
  productId,
  size || "",
  topSize || "",
  bottomSize || "",
  color || "",
  variantIdx ?? "",
].join("|").toLowerCase();

const findProductVariant = (product, { variantIdx, size, color }) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return { variant: null, sizeRow: null, invalidSelection: false };

  let variant = null;
  const idx = Number(variantIdx);

  if (variantIdx !== undefined && variantIdx !== null && !Number.isNaN(idx) && variants[idx]) {
    variant = variants[idx];
  } else if (color) {
    variant = variants.find((item) => sameText(item.color, color)) || null;
  }

  if (!variant && color) {
    const colorText = clean(color).toLowerCase();
    variant =
      variants.find((item) =>
        [item.color, item.colorName, item.name, item.colorCode]
          .filter(Boolean)
          .some((value) => clean(value).toLowerCase() === colorText)
      ) || null;
  }

  if (!variant && color && variants.length === 1) {
    variant = variants[0];
  }

  if (!variant && color) return { variant: null, sizeRow: null, invalidSelection: true };
  if (!variant) variant = variants[0];

  const sizeValue = clean(size);
  const sizeRow = sizeValue && Array.isArray(variant.sizes)
    ? variant.sizes.find((row) => sameText(row.size || row.name || row.label, sizeValue)) || null
    : null;

  return {
    variant,
    sizeRow,
    invalidSelection: Boolean(sizeValue && Array.isArray(variant.sizes) && variant.sizes.length && !sizeRow),
  };
};

const getStockAndPrice = (product, selection) => {
  const { variant, sizeRow, invalidSelection } = findProductVariant(product, selection);
  if (invalidSelection) {
    return { variant, sizeRow, stock: 0, price: Number(product.price) || 0, invalidSelection: true };
  }

  const variantStock = Array.isArray(variant?.sizes)
    ? variant.sizes.reduce((sum, row) => sum + (Number(row.stock) || 0), 0)
    : 0;

  return {
    variant,
    sizeRow,
    stock: sizeRow ? Number(sizeRow.stock) || 0 : (variant ? variantStock : Number(product.stock) || 0),
    price: Number(product.price) || 0,
    invalidSelection: false,
  };
};

const populateCart = (query) => query.populate(
  "items.productId",
  "name title price originalPrice images primaryImage hoverImage stock variants category gender status isDeleted"
);

const serializeCart = (cart, userId) => {
  const raw = typeof cart?.toObject === "function" ? cart.toObject() : cart;
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const normalizedItems = items
    .filter((item) => item?.productId)
    .map((item) => {
      const product = item.productId;
      const productId =
        product && typeof product === "object"
          ? String(product._id || product.id || "")
          : String(product || "");

      return {
        ...item,
        product,
        productId,
        lineTotal: (Number(item.price) || 0) * (Number(item.quantity) || 0),
      };
    });
  const totalPrice = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    ...(raw || {}),
    userId: raw?.userId || userId,
    items: normalizedItems,
    totalPrice,
    total: totalPrice,
  };
};

const getCartByUser = async (userId) => {
  const cart = await populateCart(Cart.findOne({ userId })).lean();
  return serializeCart(cart, userId);
};

exports.getCart = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const cart = await getCartByUser(userId);
  return ok(res, cart);
});

exports.addToCart = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const productId = clean(req.body.productId);
  const quantity = parseQty(req.body.quantity, 1);
  const size = clean(req.body.size);
  const topSize = clean(req.body.topSize);
  const bottomSize = clean(req.body.bottomSize);
  const color = clean(req.body.color);
  const variantIdx = req.body.variantIdx ?? null;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return fail(res, "Valid productId is required", 400);
  }

  const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } })
    .select("name title price stock variants status")
    .lean();

  if (!product) return fail(res, "Product not found", 404);
  if (product.status !== "active") return fail(res, "Product is unavailable", 400);
  if (quantity > MAX_ITEM_QTY) return fail(res, `Maximum ${MAX_ITEM_QTY} items allowed per cart line`, 400);

  const stockInfo = getStockAndPrice(product, { variantIdx, size: size || topSize || bottomSize, color });
  if (stockInfo.invalidSelection) return fail(res, "Selected size or color is unavailable", 400);
  if (stockInfo.stock < quantity) {
    return fail(res, stockInfo.stock > 0 ? `Only ${stockInfo.stock} items left` : "Selected item is out of stock", 400);
  }

  const variantKey = buildVariantKey({ productId, size, topSize, bottomSize, color, variantIdx });

  let cart = await Cart.findOne({ userId });
  if (!cart) cart = new Cart({ userId, items: [] });

  const existing = cart.items.find((item) => item.variantKey === variantKey);
  if (existing) {
    const nextQty = Number(existing.quantity) + quantity;
    if (nextQty > MAX_ITEM_QTY) {
      return fail(res, `Maximum ${MAX_ITEM_QTY} items allowed per cart line`, 400);
    }
    if (nextQty > stockInfo.stock) {
      return fail(res, `Only ${stockInfo.stock} items left`, 400);
    }
    existing.quantity = nextQty;
    existing.price = stockInfo.price;
  } else {
    cart.items.push({
      productId,
      quantity,
      size,
      topSize,
      bottomSize,
      color,
      variantIdx,
      variantKey,
      price: stockInfo.price,
    });
  }

  await cart.save();
  const populated = await getCartByUser(userId);
  return ok(res, populated, "Cart updated");
});

exports.updateCartItem = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const productId = clean(req.body.productId);
  const quantity = parseQty(req.body.quantity, 0);
  const size = clean(req.body.size);
  const topSize = clean(req.body.topSize);
  const bottomSize = clean(req.body.bottomSize);
  const color = clean(req.body.color);
  const variantIdx = req.body.variantIdx ?? null;

  if (!mongoose.Types.ObjectId.isValid(productId)) return fail(res, "Valid productId is required", 400);
  if (quantity <= 0) return fail(res, "Invalid quantity", 400);
  if (quantity > MAX_ITEM_QTY) return fail(res, `Maximum ${MAX_ITEM_QTY} items allowed per cart line`, 400);

  const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } })
    .select("price stock variants status")
    .lean();
  if (!product) return fail(res, "Product not found", 404);
  if (product.status !== "active") return fail(res, "Product is unavailable", 400);

  const stockInfo = getStockAndPrice(product, { variantIdx, size: size || topSize || bottomSize, color });
  if (stockInfo.invalidSelection) return fail(res, "Selected size or color is unavailable", 400);
  if (stockInfo.stock < quantity) return fail(res, `Only ${stockInfo.stock} items left`, 400);

  const cart = await Cart.findOne({ userId });
  if (!cart) return fail(res, "Cart not found", 404);

  const matches = (item) =>
    String(item.productId) === productId &&
    sameText(item.size, size) &&
    sameText(item.color, color) &&
    (!topSize || sameText(item.topSize, topSize)) &&
    (!bottomSize || sameText(item.bottomSize, bottomSize)) &&
    (variantIdx === null || Number(item.variantIdx) === Number(variantIdx));

  const item = cart.items.find(matches);
  if (!item) return fail(res, "Item not found", 404);

  item.quantity = quantity;
  item.price = stockInfo.price;
  await cart.save();

  const populated = await getCartByUser(userId);
  return ok(res, populated, "Cart item updated");
});

exports.removeCartItem = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const productId = clean(req.params.productId);
  const size = clean(req.query.size);
  const color = clean(req.query.color);
  const topSize = clean(req.query.topSize);
  const bottomSize = clean(req.query.bottomSize);
  const variantIdx = req.query.variantIdx ?? null;

  if (!mongoose.Types.ObjectId.isValid(productId)) return fail(res, "Valid productId is required", 400);

  const cart = await Cart.findOne({ userId });
  if (!cart) return ok(res, { userId, items: [] });

  cart.items = cart.items.filter((item) => {
    const sameProduct = String(item.productId) === productId;
    const sameSize = !size || sameText(item.size, size);
    const sameColor = !color || sameText(item.color, color);
    const sameTopSize = !topSize || sameText(item.topSize, topSize);
    const sameBottomSize = !bottomSize || sameText(item.bottomSize, bottomSize);
    const sameVariant = variantIdx === null || Number(item.variantIdx) === Number(variantIdx);
    return !(sameProduct && sameSize && sameColor && sameTopSize && sameBottomSize && sameVariant);
  });

  await cart.save();
  const populated = await getCartByUser(userId);
  return ok(res, populated, "Item removed");
});

exports.clearCart = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  await Cart.clearCart(userId);
  return ok(res, { userId, items: [] }, "Cart cleared");
});
