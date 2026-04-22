/**
 * dynamicMapper.js (FINAL)
 * Fully safe, normalized, crash-proof mapping layer
 */

// ======================
// HELPERS
// ======================
const safeArray = (val) => (Array.isArray(val) ? val : []);
const safeNumber = (val, fallback = 0) =>
  typeof val === "number" && !isNaN(val) ? val : fallback;

// ======================
// PRODUCT
// ======================
export const mapProduct = (item) => {
  if (!item || typeof item !== "object") return null;

  const images = safeArray(item.images).length
    ? item.images
    : item.image
      ? [item.image]
      : [];

  const variants = safeArray(item.variants).map((v) => ({
    ...v,
    images: safeArray(v.images),
    sizes: safeArray(v.sizes).map((s) => ({
      ...s,
      discount: safeNumber(s.discount),
      stock: safeNumber(s.stock),
    })),
  }));

  return {
    id: String(item._id || item.id || ""),

    title: item.name || item.title || "Unnamed Product",
    description: item.description || "",
    shortDescription: item.shortDescription || "",
    fullDescription: item.fullDescription || "",

    brand: item.brand || "",
    subcategory: item.subcategory || "",
    productType: item.productType || "",

    price: safeNumber(item.price) || safeNumber(variants[0]?.price),
    originalPrice: safeNumber(item.originalPrice || item.price) || safeNumber(variants[0]?.price),

    images,
    image: item.primaryImage || images[0] || "",
    hoverImage: item.hoverImage || images[1] || images[0] || "",

    video: item.video || "",

    // CATEGORY SAFE NORMALIZATION
    category:
      typeof item.category === "string"
        ? {
          main: item.category.toUpperCase(),
          sub: "",
          type: "",
          brand: "DOLLER COACH",
          tags: safeArray(item.tags),
        }
        : {
          main: item.category?.main || "MEN",
          sub: item.category?.sub || "",
          type: item.category?.type || "",
          brand: item.category?.brand || "DOLLER COACH",
          tags: safeArray(item.tags),
        },

    type: item.type || "TOPWEAR",

    stock: safeNumber(item.stock),
    status: item.status || "active",

    // ADVANCED FIELDS (HOT SELL LOGIC)
    variants,

    offer: {
      text: item.offer?.text || item.offerText || "",
      type: item.offer?.offerType || "PERCENTAGE",
      expiry: item.offer?.expiry || null,
      isHighlighted: !!item.offer?.isHighlighted,
      enabled: !!item.offer?.enabled,
    },

    // COMPUTED DISCOUNT
    discount: item.discount ?? (
      item.originalPrice > item.price 
        ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100) 
        : 0
    ),

    // COMPUTED HOT SELL STATUS
    isHot: !!item.isHot || 
          (Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100) >= 50) ||
          (safeNumber(item.salesCount) > 50),

    badge: {
      text:
        item.badge?.text ||
        (typeof item.badge === "string" ? item.badge : ""),
      color: item.badge?.color || "#0f172a",
      type: item.badge?.badgeType || "solid",
      icon: item.badge?.icon || "",
      enabled: !!item.badge?.enabled,
    },

    ratings: {
      average: safeNumber(item.ratings?.average || item.rating),
      count: safeNumber(item.ratings?.count || item.numReviews),
      enabled: item.ratings?.enabled !== false,
    },

    seo: {
      title: item.seo?.metaTitle || "",
      description: item.seo?.metaDescription || "",
      image: item.seo?.ogImage || "",
    },

    controls: {
      cod: item.controls?.codAllowed !== false,
      eta: item.controls?.showETA !== false,
      wishlist: item.controls?.allowWishlist !== false,
    },

    colorsAvailable:
      item.colorsAvailable || (variants.length ? variants.length : 1),

    featured: !!item.featured,
    trending: !!item.isTrending || !!item.trending,
    isNew: !!item.isNewlyLaunched || !!item.isNew,
    isBestSeller: !!item.isBestSeller,

    sizes: safeArray(item.sizes).length 
      ? safeArray(item.sizes) 
      : [...new Set(variants.map(v => v.size).filter(Boolean))],
    topSizes: safeArray(item.topSizes),
    bottomSizes: safeArray(item.bottomSizes),
  };
};

// ======================
// USER
// ======================
export const mapUser = (data) => {
  if (!data) return null;

  const isObj = typeof data === "object";

  return {
    id: isObj ? data._id || data.id || "" : data,
    name: isObj ? data.name || "User" : "User",
    email: isObj ? data.email || "" : "",
    role: isObj ? data.role || "user" : "user",
    avatar: isObj ? data.avatar || "" : "",
    isVerified: isObj ? !!data.isVerified : false,
  };
};

// ======================
// CART ITEM
// ======================
export const mapCartItem = (item) => {
  if (!item) return null;

  const source = item.productId || item.product || {};
  const isPopulated = typeof source === "object" && source !== null;

  const product = isPopulated ? source : item;
  const mapped = mapProduct(product);

  if (!mapped) return null;

  return {
    ...mapped,
    id: isPopulated
      ? source._id || source.id
      : item.productId || mapped.id,

    cartItemId: item._id || item.id || mapped.id,

    quantity: safeNumber(item.quantity, 1),

    size: item.size || "",
    topSize: item.topSize || "",
    bottomSize: item.bottomSize || "",
  };
};

// ======================
// ORDER
// ======================
export const mapOrder = (order) => {
  if (!order) return null;

  const shipping = order.shippingAddress || {};

  return {
    id: order._id || order.id || "",
    _id: order._id || order.id || "",

    invoiceNumber: order.invoiceNumber || "N/A",

    subtotal: safeNumber(order.subtotal ?? order.subtotalAmount),
    discount: safeNumber(order.discount ?? order.discountAmount),
    delivery: safeNumber(order.delivery ?? order.deliveryFee),
    gst: safeNumber(order.gst ?? order.gstAmount),
    total: safeNumber(order.total ?? order.totalAmount),

    status: order.status || "placed",

    paymentMethod: order.paymentMethod || "COD",
    paymentStatus:
      order.paymentStatus || (order.isPaid ? "PAID" : "PENDING"),

    createdAt: order.createdAt || new Date().toISOString(),

    products: safeArray(order.products)
      .map(mapCartItem)
      .filter(Boolean),

    user: mapUser(order.userId),

    shippingAddress: {
      name: shipping.name || "N/A",
      phone: shipping.phone || "N/A",
      address: shipping.address || "N/A",
      city: shipping.city || "",
      state: shipping.state || "",
      pincode: shipping.pincode || "",
    },

    isPaid: !!order.isPaid,
    paidAt: order.paidAt || null,

    shiprocket: {
      orderId: order.shiprocket?.orderId || null,
      shipmentId: order.shiprocket?.shipmentId || null,
      awbCode: order.shiprocket?.awbCode || null,
      courierName: order.shiprocket?.courierName || null,
      trackingUrl: order.shiprocket?.trackingUrl || null,
      status: order.shiprocket?.status || "NOT_SYNCED",
    }
  };
};

// ======================
// OFFER
// ======================
export const mapOffer = (offer) => {
  if (!offer) return null;

  return {
    id: offer._id || offer.id || "",
    title: offer.title || "Special Offer",
    description: offer.description || "",
    image: offer.image || "",
    link: offer.link || "/",
    isActive: !!offer.isActive,
    status: offer.status || "OFF",
    endDate: offer.endDate || null,
    couponCode: offer.couponCode || "",
    discountType: offer.discountType || "percentage",
    discountValue: safeNumber(offer.discountValue),
  };
};

// ======================
// REVIEW
// ======================
export const mapReview = (review) => {
  if (!review) return null;

  return {
    id: review._id || review.id || "",
    user: review.user?.name || "Anonymous",
    product: review.product?.title || "Product",
    rating: safeNumber(review.rating),
    comment: review.comment || "",
    status: review.status || "pending",
    createdAt: review.createdAt || new Date().toISOString(),
  };
};