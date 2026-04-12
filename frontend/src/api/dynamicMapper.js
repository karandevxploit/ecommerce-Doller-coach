/**
 * dynamicMapper.js
 * Safely maps unknown API structures to generic UI components.
 */

export const mapProduct = (item) => {
  if (!item) return null;
  const images = Array.isArray(item.images) ? item.images : (item.image ? [item.image] : []);
  return {
    id: item._id || item.id || "",
    title: item.title || "Unnamed Product",
    description: item.description || "No description available",
    price: item.price !== undefined ? item.price : 0,
    images: images,
    image: images[0] || "",
    video: item.video || "",
    category: item.category || "Uncategorized",
    type: item.type || "TOPWEAR",
    stock: item.stock !== undefined ? item.stock : 0,
    rating: item.rating || 0,
    numReviews: item.numReviews || 0,
    sizes: Array.isArray(item.sizes) ? item.sizes : [],
    topSizes: Array.isArray(item.topSizes) ? item.topSizes : [],
    bottomSizes: Array.isArray(item.bottomSizes) ? item.bottomSizes : [],
    discount: item.discountAmount || 0,
    discountPercent: item.discountPercent || 0,
    featured: !!item.featured,
    trending: !!item.trending
  };
};

export const mapUser = (data) => {
  if (!data) return null;
  // Handle case where userId is just an ID string, not populated
  const isObj = typeof data === 'object';
  return {
    id: isObj ? (data._id || data.id || "") : data,
    name: isObj ? (data.name || "User") : "User",
    email: isObj ? (data.email || "") : "",
    role: isObj ? (data.role || "user") : "user",
    isVerified: isObj ? !!data.isVerified : false
  };
};

export const mapCartItem = (item) => {
  if (!item) return null;
  
  // Safe-guard: Extract product data while handling legacy/deleted references
  const productSource = item.productId || item.product || {};
  const isPopulated = typeof productSource === 'object' && productSource !== null;
  
  const productData = isPopulated ? productSource : item;
  const mappedProduct = mapProduct(productData);
  
  return {
    ...mappedProduct,
    id: isPopulated ? (productSource._id || productSource.id) : (item.productId || mappedProduct.id),
    cartItemId: item._id || item.id || mappedProduct.id,
    quantity: item.quantity || 1,
    size: item.size || "",
    topSize: item.topSize || "",
    bottomSize: item.bottomSize || ""
  };
};

export const mapOrder = (order) => {
  if (!order) return null;
  const shipping = order.shippingAddress || {};
  const products = Array.isArray(order.products) 
    ? order.products.map(mapCartItem).filter(Boolean) 
    : [];
  
  return {
    id: order._id || order.id || "",
    _id: order._id || order.id || "", // Backward compatibility for legacy listeners
    invoiceNumber: order.invoiceNumber || "N/A",
    subtotal: order.subtotal ?? order.subtotalAmount ?? 0,
    discount: order.discount ?? order.discountAmount ?? 0,
    delivery: order.delivery ?? order.deliveryFee ?? 0,
    gst: order.gst ?? order.gstAmount ?? 0,
    total: order.total ?? order.totalAmount ?? 0,
    status: order.status || "placed",
    paymentMethod: order.paymentMethod || "COD",
    paymentStatus: order.paymentStatus || (order.isPaid ? "PAID" : "PENDING"),
    createdAt: order.createdAt || new Date().toISOString(),
    products,
    user: mapUser(order.userId),
    shippingAddress: {
      name: shipping.name || "N/A",
      phone: shipping.phone || "N/A",
      address: shipping.address || "N/A",
      city: shipping.city || "",
      state: shipping.state || "",
      pincode: shipping.pincode || ""
    },
    isPaid: !!order.isPaid,
    paidAt: order.paidAt || null
  };
};

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
    discountValue: offer.discountValue || 0,
  };
};

export const mapReview = (review) => {
  if (!review) return null;
  return {
    id: review._id || review.id || "",
    user: review.user?.name || "Anonymous",
    product: review.product?.title || "Product",
    rating: review.rating || 0,
    comment: review.comment || "",
    status: review.status || "pending",
    createdAt: review.createdAt || new Date().toISOString(),
  };
};
