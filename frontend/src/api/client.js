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
// REQUEST DEDUPLICATION (ACTIVE)
// ======================
const pendingRequests = new Map();

const getRequestKey = (config) => {
  const url = config.url || "";
  const method = config.method || "get";
  const params = JSON.stringify(config.params || {});
  return `${method}:${url}:${params}`;
};

// ======================
// REFRESH TOKEN FUNCTION
// ======================
const refreshAccessToken = async () => {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      {},
      { withCredentials: true, timeout: 10000 }
    );

    const newToken = res?.data?.data?.accessToken || res?.data?.accessToken;
    if (!newToken) throw new Error("Token extraction failed");

    setAccessToken(newToken);
    return newToken;
  } catch (err) {
    console.error("Critical: Refresh Token Failed", err.message);
    throw err;
  }
};

// ======================
// REQUEST INTERCEPTOR
// ======================
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      const isAuthRoute = ["/login", "/register", "/auth/login", "/auth/register", "/auth/me"].some(path => 
        window.location.pathname.includes(path) || error.config?.url?.includes(path)
      );

      if (!isAuthRoute) {
        clearAuth();
        const isAdminRoute = window.location.pathname.startsWith("/admin");
        window.location.href = isAdminRoute ? "/admin/login" : "/login";
      }
    }

    return Promise.reject(error);
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

export { api };