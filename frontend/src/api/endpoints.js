/**
 * API ENDPOINTS REGISTRY
 * - Consistent naming
 * - Admin/User separation
 * - Function-safe dynamic routes
 */

const build = (path) => `${path}`;

const byId = (base, id) => `${base}/${encodeURIComponent(String(id))}`;

export const ENDPOINTS = {
  AUTH: {
    LOGIN: build("/auth/login"),
    REGISTER: build("/auth/register"),
    LOGOUT: build("/auth/logout"),
    REFRESH: build("/auth/refresh-token"),
    PROFILE: build("/auth/profile"),
    ADDRESSES: build("/auth/addresses"),
    SEND_OTP: build("/auth/send-otp"),
    VERIFY_OTP: build("/auth/verify-otp"),
    RESEND_OTP: build("/auth/resend-otp"),
    RESET_PASSWORD: build("/auth/reset-password"),

    ADMIN_LOGIN: build("/auth/admin-login"),
    ADMIN_EXISTS: build("/auth/admin-exists"),
  },

  PRODUCTS: {
    LIST: build("/products"),
    GET: (id) => byId("/products", id),
    FILTERS: build("/products/filters"),
  },

  CART: {
    BASE: build("/cart"),
    ADD: build("/cart/add"),
  },

  WISHLIST: {
    BASE: build("/wishlists"),
  },

  COUPONS: {
    BASE: build("/coupons"),
    APPLY: build("/coupons/apply"),
  },

  ORDERS: {
    BASE: build("/orders"),
    MY: build("/orders/my"),
    GET: (id) => byId("/orders", id),
    CHECKOUT: build("/orders/checkout"),
    INVOICE: (id) => `${byId("/orders", id)}/invoice`,
  },

  PAYMENTS: {
    CREATE_ORDER: build("/payments/create-order"),
    VERIFY: build("/payments/verify"),
    WEBHOOK: build("/payments/webhook"),
  },

  REVIEWS: {
    BASE: build("/reviews"),
    BY_PRODUCT: (id) => byId("/reviews/product", id),
  },

  DELIVERY: {
    CHECK: (pincode) => byId("/delivery/check", pincode),
  },

  UPLOADS: {
    MULTIPLE: build("/uploads/multiple"),
    SINGLE: build("/uploads/single"),
  },

  CONFIG: build("/config"),

  CMS: {
    SITE_CONTENT: build("/site-content"),
  },

  CATEGORIES: {
    BASE: build("/categories"),
    GET: (id) => byId("/categories", id),
  },

  ADMIN: {
    DASHBOARD: build("/admin/dashboard"),
    NOTIFICATIONS: build("/admin/notifications"),
    PAY: build("/admin/pay"),

    ANALYTICS: {
      OVERVIEW: build("/admin/stats"),
      TRAFFIC: build("/admin/orders/trend"),
      REVENUE_TREND: build("/admin/revenue/trend"),
      TOP_PRODUCTS: build("/admin/products"),
      ACTIVE_USERS: build("/admin/analytics/active-users"),
      HEALTH: build("/admin/analytics/health"),
    },

    PRODUCTS: {
      BASE: build("/admin/products"),
      GET: (id) => byId("/admin/products", id),
      STATUS: (id) => `${byId("/admin/products", id)}/status`,
    },

    ORDERS: {
      BASE: build("/admin/orders"),
      GET: (id) => byId("/admin/orders", id),
      STATUS: (id) => `${byId("/admin/orders", id)}/status`,
      PAYMENT: (id) => `${byId("/admin/orders", id)}/payment`,
      INVOICE: (id) => `${byId("/admin/orders", id)}/invoice`,
      TREND: build("/admin/orders/trend"),
    },

    USERS: {
      BASE: build("/admin/users"),
      GET: (id) => byId("/admin/users", id),
    },

    OFFERS: {
      BASE: build("/admin/offers"),
      GET: (id) => byId("/admin/offers", id),
    },

    SHIPMENTS: {
      BASE: build("/admin/shipments"),
      GET: (id) => byId("/admin/shipments", id),
    },

    CATEGORIES: {
      BASE: build("/admin/categories"),
      GET: (id) => byId("/admin/categories", id),
    },

    REVIEWS: {
      BASE: build("/reviews/admin"),
      APPROVE: (id) => `${byId("/reviews/admin", id)}/approve`,
      DELETE: (id) => byId("/reviews/admin", id),
    },

    SITE_CONTENT: build("/site-content"),
    CONFIG: build("/config"),
  },
};
