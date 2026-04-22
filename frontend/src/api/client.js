import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8001/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ======================
// TOKEN MANAGEMENT
// ======================
let accessToken =
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  null;

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// ======================
// REQUEST DEDUPLICATION (IMPROVED)
// ======================
const pendingRequests = new Map();

const getRequestKey = (config) => {
  const url = config.url || "";
  const method = config.method || "get";
  const params = JSON.stringify(config.params || {});
  const data = JSON.stringify(config.data || {});
  return `${method}:${url}:${params}:${data}`;
};

// ======================
// REFRESH TOKEN FUNCTION
// ======================
const refreshAccessToken = async () => {
  const res = await axios.post(
    `${API_BASE_URL}/auth/refresh-token`,
    {},
    { withCredentials: true }
  );

  const newToken = res?.data?.accessToken;

  if (!newToken) throw new Error("No token received");

  setAccessToken(newToken);
  return newToken;
};

// ======================
// REQUEST INTERCEPTOR
// ======================
api.interceptors.request.use(
  (config) => {
    if (config.url === "/auth/refresh") return config;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 🚫 Stop on 429
    if (error.response?.status === 429) {
      console.error("[API] Rate limited");
      return Promise.reject(error);
    }

    // 🚫 Non-401 → reject
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // 🚫 Prevent infinite loop
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    // 🚫 If refresh fails
    if (originalRequest.url === "/auth/refresh-token") {
      clearAuth();
      const isAdminRoute = window.location.pathname.startsWith("/admin");
      window.location.href = isAdminRoute ? "/admin/login" : "/login";
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // 🔄 If already refreshing → queue
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();

      onTokenRefreshed(newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (err) {
      clearAuth();
      const isAdminRoute = window.location.pathname.startsWith("/admin");
      window.location.href = isAdminRoute ? "/admin/login" : "/login";
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

// ======================
// TOKEN HELPERS
// ======================
export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    clearAuth();
  }
};

export const getAccessToken = () => accessToken;

export const clearAuth = () => {
  accessToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("token");
};

// ======================
// EXPORT
// ======================
export { api };