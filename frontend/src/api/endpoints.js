/**
 * API ENDPOINTS REGISTRY (FINAL)
 * - Consistent naming
 * - Admin/User separation
 * - Function-safe dynamic routes
 * - Future scalable structure
 */

const build = (path) => path;

export const ENDPOINTS = {
  // ======================
  // AUTH
  // ======================
  AUTH: {
    LOGIN: build("/auth/login"),
    REGISTER: build("/auth/register"),
    LOGOUT: build("/auth/logout"),
    REFRESH: build("/auth/refresh"), // 🔥 unified (fixed naming mismatch)
    PROFILE: build("/auth/profile"),
    ADDRESSES: build("/auth/addresses"),
    SEND_OTP: build("/auth/send-otp"),
    VERIFY_OTP: build("/auth/verify-otp"),
    RESET_PASSWORD: build("/auth/reset-password"),

    ADMIN_LOGIN: build("/auth/admin-login"),
    ADMIN_EXISTS: build("/auth/admin-exists"),
  },

  // ======================
  // PRODUCTS
  // ======================
  PRODUCTS: {
    LIST: build("/products"),
    GET: (id) => `/products/${id}`,
    FILTERS: build("/products/filters"),
  },

  // ======================
  // CART & WISHLIST
  // ======================
  CART: {
    BASE: build("/carts"),
  },

  WISHLIST: {
    BASE: build("/wishlists"),
  },

  // ======================
  // COUPONS
  // ======================
  COUPONS: {
    BASE: build("/coupons"),
    APPLY: build("/coupons/apply"),
  },

  // ======================
  // ORDERS
  // ======================
  ORDERS: {
    BASE: build("/orders"),
    MY: build("/orders/my"),
    GET: (id) => `/orders/${id}`,
    CHECKOUT: build("/orders/checkout"),
  },

  // ======================
  // PAYMENTS
  // ======================
  PAYMENTS: {
    CREATE_ORDER: build("/payments/create-order"),
    VERIFY: build("/payments/verify"),
    WEBHOOK: build("/payments/webhook"),
  },

  // ======================
  // REVIEWS
  // ======================
  REVIEWS: {
    BASE: build("/reviews"),
    BY_PRODUCT: (id) => `/reviews/product/${id}`,
  },

  // ======================
  // DELIVERY
  // ======================
  DELIVERY: {
    CHECK: (pincode) => `/delivery/check/${pincode}`,
  },

  // ======================
  // UPLOADS
  // ======================
  UPLOADS: {
    MULTIPLE: build("/uploads/multiple"),
    SINGLE: build("/uploads/single"), // 🔥 added (you used it elsewhere)
  },

  // ======================
  // CONFIG / CMS
  // ======================
  CONFIG: build("/config"),

  CMS: {
    SITE_CONTENT: build("/site-content"),
  },

  // ======================
  // 🔥 ADMIN (IMPORTANT)
  // ======================
  ADMIN: {
    ANALYTICS: {
      OVERVIEW: build("/admin/stats"),
      TRAFFIC: build("/admin/revenue/trend"),
      TOP_PRODUCTS: build("/admin/stats"), // Reuse main stats if specific one doesn't exist
      ACTIVE_USERS: build("/admin/customers/stats"),
      HEALTH: build("/admin/stats"),
    },

    PRODUCTS: {
      BASE: build("/admin/products"),
      GET: (id) => `/admin/products/${id}`,
    },

    ORDERS: {
      BASE: build("/admin/orders"),
      STATUS: (id) => `/admin/orders/${id}/status`,
    },

    USERS: {
      BASE: build("/admin/users"),
    },

    OFFERS: {
      BASE: build("/admin/offers"),
      GET: (id) => `/admin/offers/${id}`,
    },

    REVIEWS: {
      BASE: build("/reviews/admin"),
      APPROVE: (id) => `/reviews/admin/${id}/approve`,
      DELETE: (id) => `/reviews/admin/${id}`,
    },
  },
};