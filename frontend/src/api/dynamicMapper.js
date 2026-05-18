/**
 * dynamicMapper.js
 * Fully safe, normalized mapping layer
 */

const safeArray = (value) => (Array.isArray(value) ? value : []);

const safeObject = (value) => {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const calculateDiscount = (price, originalPrice) => {
  const current = safeNumber(price);
  const original = safeNumber(originalPrice);

  if (original <= 0 || current <= 0 || original <= current) return 0;

  return Math.round(((original - current) / original) * 100);
};

const normalizeId = (value, fallback = "") => {
  return safeString(value?._id || value?.id || value || fallback);
};

const isUsableImage = (value) => {
  const image = typeof value === "string" ? value.trim() : "";
  if (!image) return false;

  return (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:image/") ||
    image.startsWith("blob:") ||
    image.startsWith("/uploads/") ||
    image.startsWith("uploads/")
  );
};

const pickFirstImage = (images, fallback = "") => {
  const usable = safeArray(images).find(isUsableImage);
  return usable || fallback;
};

const normalizeImageList = (item) => {
  const images = [
    item?.primaryImage,
    item?.image,
    item?.imageUrl,
    item?.secure_url,
    item?.src,
    item?.thumbnail,
    ...safeArray(item?.images),
    ...safeArray(item?.variants).flatMap((variant) => [
      variant?.image,
      variant?.imageUrl,
      variant?.thumbnail,
      ...safeArray(variant?.images),
    ]),
  ].filter(isUsableImage);

  if (images.length) return [...new Set(images)];

  return [];
};

export const mapProduct = (item = {}) => {
  const source = safeObject(item);
  const images = normalizeImageList(source);

  const variants = safeArray(source.variants).map((variant) => {
    const variantSource = safeObject(variant);
    const variantImages = normalizeImageList(variantSource);
    const flatSize = variantSource.size || variantSource.name || "";
    const nestedSizes = safeArray(variantSource.sizes).map((size) => ({
      ...safeObject(size),
      size: size?.size || size?.name || size?.label || "",
      discount: safeNumber(size?.discount),
      stock: safeNumber(size?.stock),
    }));

    return {
      ...variantSource,
      image: pickFirstImage(
        [variantSource.image, variantSource.imageUrl, variantSource.thumbnail, variantImages[0]],
        ""
      ),
      images: variantImages,
      sizes: nestedSizes.length
        ? nestedSizes
        : flatSize
          ? [{ size: flatSize, stock: safeNumber(variantSource.stock) }]
          : [],
      price: safeNumber(variantSource.price),
      stock: safeNumber(variantSource.stock),
      size: flatSize,
    };
  });

  const firstVariantPrice = safeNumber(variants?.[0]?.price);
  const price = safeNumber(source.price, firstVariantPrice);
  const originalPrice = safeNumber(source.originalPrice ?? source.mrp, price);
  const discount = safeNumber(source.discount, calculateDiscount(price, originalPrice));
  const variantStock = variants.reduce((total, variant) => {
    const sizeStock = safeArray(variant?.sizes).reduce(
      (sum, size) => sum + safeNumber(size?.stock),
      0
    );

    return total + (sizeStock || safeNumber(variant?.stock));
  }, 0);

  const category =
    typeof source.category === "string"
      ? {
        id: source.category,
        _id: source.category,
        slug: source.category,
        name: source.category,
        main: source.category.toUpperCase(),
        sub: "",
        type: "",
        gender: source.gender || "",
        brand: "DOLLER COACH",
        tags: safeArray(source.tags),
      }
      : {
        id: normalizeId(source.category),
        _id: normalizeId(source.category),
        slug: source.category?.slug || "",
        name: source.category?.name || "",
        main: source.category?.main || source.category?.name || "MEN",
        sub: source.category?.sub || source.subcategory || "",
        type: source.category?.type || source.productType || "",
        gender: source.category?.gender || source.gender || "",
        brand: source.category?.brand || source.brand || "DOLLER COACH",
        tags: safeArray(source.tags),
      };

  return {
    id: normalizeId(source),
    _id: normalizeId(source),

    title: source.name || source.title || "Unnamed Product",
    description: source.description || "",
    shortDescription: source.shortDescription || "",
    fullDescription: source.fullDescription || "",

    brand: source.brand || "",
    subcategory: source.subcategory || "",
    productType: source.productType || "",

    price,
    originalPrice,

    images,
    image: pickFirstImage([source.primaryImage, images[0]]),
    hoverImage: pickFirstImage([source.hoverImage, images[1], images[0]]),

    video: source.video?.url || (typeof source.video === "string" ? source.video : ""),

    category,
    type: source.type || source.productType || "TOPWEAR",

    stock: source.stock === undefined || source.stock === null
      ? variantStock
      : safeNumber(source.stock),
    status: source.status || (source.isActive === false ? "inactive" : "active"),

    variants,

    offer: {
      text: source.offer?.text || source.offerText || "",
      type: source.offer?.offerType || source.offer?.type || "PERCENTAGE",
      title: source.offer?.title || "",
      discount: safeNumber(source.offer?.discount),
      couponCode: source.offer?.couponCode || "",
      startDate: source.offer?.startDate || null,
      expiryDate: source.offer?.expiryDate || source.offer?.expiry || null,
      isActive: Boolean(source.offer?.isActive || source.offer?.enabled),
    },

    discount,

    isHot:
      Boolean(source.isHot) ||
      discount >= 50 ||
      safeNumber(source.salesCount) > 50,

    badge: {
      text:
        source.badge?.text ||
        (typeof source.badge === "string" ? source.badge : ""),
      color: source.badge?.color || "#0f172a",
      type: source.badge?.badgeType || source.badge?.type || "solid",
      icon: source.badge?.icon || "",
      enabled: Boolean(source.badge?.enabled),
    },

    ratings: {
      average: safeNumber(source.ratings?.average ?? source.rating),
      count: safeNumber(source.ratings?.count ?? source.numReviews),
      enabled: source.ratings?.enabled !== false,
    },

    seo: {
      title: source.seo?.metaTitle || source.seo?.title || "",
      description: source.seo?.metaDescription || source.seo?.description || "",
      image: source.seo?.ogImage || source.seo?.image || "",
    },

    controls: {
      cod: source.controls?.codAllowed !== false,
      eta: source.controls?.showETA !== false,
      wishlist: source.controls?.allowWishlist !== false,
    },

    colorsAvailable: safeNumber(
      source.colorsAvailable,
      variants.length ? variants.length : 1
    ),

    featured: Boolean(source.featured),
    trending: Boolean(source.isTrending || source.trending),
    isNew: Boolean(source.isNewlyLaunched || source.isNew),
    isBestSeller: Boolean(source.isBestSeller),

    sizes: safeArray(source.sizes).length
      ? safeArray(source.sizes)
      : [
        ...new Set(
          variants
            .flatMap((variant) => [
              variant.size,
              ...safeArray(variant.sizes).map((size) => size?.size),
            ])
            .filter(Boolean)
        ),
      ],
    topSizes: safeArray(source.topSizes),
    bottomSizes: safeArray(source.bottomSizes),
  };
};

export const mapUser = (data = {}) => {
  const source = safeObject(data);

  return {
    id: normalizeId(source),
    _id: normalizeId(source),
    name: source.name || source.fullName || "User",
    email: source.email || "",
    role: source.role || "user",
    avatar: source.avatar || source.profileImage || "",
    isVerified: Boolean(source.isVerified || source.verified),
    createdAt: source.createdAt || source.updatedAt || null,
  };
};

export const mapCartItem = (item = {}) => {
  const source = safeObject(item);
  const productSource = source.productId || source.product || source;
  const product = mapProduct(productSource);

  return {
    ...product,
    id: normalizeId(productSource, product.id),
    cartItemId: normalizeId(source, product.id),
    quantity: safeNumber(source.quantity, 1),
    size: source.size || "",
    topSize: source.topSize || "",
    bottomSize: source.bottomSize || "",
    color: source.color || "",
    variantIdx: source.variantIdx ?? null,
    variantKey: source.variantKey || "",
    price: safeNumber(source.price, product.price),
    title: source.title || product.title,
    image: source.image || product.image,
  };
};

export const mapOrder = (order = {}) => {
  const source = safeObject(order);
  const shipping = source.shippingAddress || source.address || {};
  const user = source.userId || source.user || source.customer || {};

  const products = safeArray(source.products?.length ? source.products : source.items)
    .map(mapCartItem)
    .filter(Boolean);

  const paymentStatus =
    source.paymentStatus || (source.isPaid ? "PAID" : "PENDING");

  return {
    id: normalizeId(source),
    _id: normalizeId(source),

    invoiceNumber: source.invoiceNumber || "N/A",

    subtotal: safeNumber(source.subtotal ?? source.subtotalAmount),
    discount: safeNumber(source.discount ?? source.discountAmount),
    delivery: safeNumber(source.delivery ?? source.deliveryFee),
    codFee: safeNumber(source.codFee ?? source.cod_fee ?? source.charges?.codFee),
    gst: safeNumber(source.gst ?? source.gstAmount),
    gstPercent: safeNumber(source.gstPercent ?? source.gst_percent, 18),
    total: safeNumber(source.total ?? source.totalAmount ?? source.amount),

    status: source.status || "placed",

    paymentMethod: source.paymentMethod || "COD",
    paymentStatus,

    createdAt: source.createdAt || source.updatedAt || null,

    products,
    user: mapUser(user),

    address: shipping,

    shippingAddress: {
      name: shipping.name || shipping.fullName || user?.name || "N/A",
      phone: shipping.phone || source.phone || user?.phone || "N/A",
      address: shipping.address || shipping.addressLine1 || shipping.street || "N/A",
      city: shipping.city || "",
      state: shipping.state || "",
      pincode: shipping.pincode || shipping.zip || shipping.postalCode || "",
    },

    phone: shipping.phone || source.phone || user?.phone || "",

    isPaid: Boolean(
      source.isPaid || String(paymentStatus).toUpperCase() === "PAID"
    ),
    paidAt: source.paidAt || null,

    shiprocket: {
      orderId: source.shiprocket?.orderId || null,
      shipmentId: source.shiprocket?.shipmentId || null,
      awbCode: source.shiprocket?.awbCode || null,
      courierName: source.shiprocket?.courierName || null,
      trackingUrl: source.shiprocket?.trackingUrl || null,
      status: source.shiprocket?.status || "NOT_SYNCED",
    },

    shipment: {
      shipmentId:
        source.shipment?.shipment_id ||
        source.shipment?.shipmentId ||
        source.shiprocket?.shipmentId ||
        null,
      awbCode:
        source.shipment?.awb_code ||
        source.shipment?.awbCode ||
        source.shiprocket?.awbCode ||
        null,
      courierName:
        source.shipment?.courier_name ||
        source.shipment?.courierName ||
        source.shiprocket?.courierName ||
        null,
      trackingUrl:
        source.shipment?.tracking_url ||
        source.shipment?.trackingUrl ||
        source.shiprocket?.trackingUrl ||
        null,
      estimatedDelivery:
        source.shipment?.estimated_delivery ||
        source.shipment?.estimatedDelivery ||
        null,
      status: source.shipment_status || source.shipment?.status || "pending",
      lastUpdatedAt:
        source.shipment?.last_updated_at ||
        source.shipment?.lastUpdatedAt ||
        null,
    },

    shipment_status: source.shipment_status || source.shipment?.status || "pending",
  };
};

export const mapOffer = (offer = {}) => {
  const source = safeObject(offer);
  const discountValue = safeNumber(source.discountValue ?? source.discount);

  return {
    id: normalizeId(source),
    _id: normalizeId(source),
    title: source.title || "Special Offer",
    description: source.description || "",
    image: source.image || source.imageUrl || "",
    link: source.link || "/",
    isActive: Boolean(source.isActive),
    status: source.status || (source.isActive ? "ACTIVE" : "OFF"),
    startDate: source.startDate || null,
    endDate: source.endDate || null,
    remainingTime: safeNumber(source.remainingTime),
    couponCode: source.couponCode || "",
    discountType: source.discountType || "percentage",
    discountValue,
    discount: discountValue,
    usageLimit: safeNumber(source.usageLimit),
    usedCount: safeNumber(source.usedCount),
    perUserLimit: safeNumber(source.perUserLimit),
    minOrderAmount: safeNumber(source.minOrderAmount),
    maxDiscount:
      source.maxDiscount === null || source.maxDiscount === undefined
        ? null
        : safeNumber(source.maxDiscount),
  };
};

export const mapReview = (review = {}) => {
  const source = safeObject(review);

  return {
    id: normalizeId(source),
    _id: normalizeId(source),
    user:
      source.user?.name ||
      source.userName ||
      source.customer?.name ||
      "Anonymous",
    product:
      source.product?.title ||
      source.product?.name ||
      source.productName ||
      "Product",
    rating: Math.min(Math.max(safeNumber(source.rating), 0), 5),
    comment: source.comment || source.review || source.message || "",
    status: source.status || (source.isApproved ? "approved" : "pending"),
    createdAt: source.createdAt || source.updatedAt || null,
  };
};
