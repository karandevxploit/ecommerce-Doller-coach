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
  return {
    id: data._id || data.id || "",
    name: data.name || "User",
    email: data.email || "",
    role: data.role || "user",
    isVerified: !!data.isVerified
  };
};

export const mapCartItem = (item) => {
  if (!item) return null;
  
  const productData = (item.productId && typeof item.productId === 'object') 
    ? item.productId 
    : (item.product && typeof item.product === 'object' ? item.product : item);

  const mappedProduct = mapProduct(productData);
  
  return {
    ...mappedProduct,
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
  return {
    id: order._id || order.id || "",
    invoiceNumber: order.invoiceNumber || "N/A",
    totalAmount: order.totalAmount || 0,
    status: order.status || "placed",
    paymentStatus: order.paymentStatus || "PENDING",
    paymentMethod: order.paymentMethod || "COD",
    createdAt: order.createdAt || new Date().toISOString(),
    products: Array.isArray(order.products) 
      ? order.products.map(mapCartItem) 
      : [],
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
