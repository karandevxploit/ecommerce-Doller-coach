import axios from "axios";
import toast from "react-hot-toast";
import { translateError } from "../utils/userFriendlyErrors";

let rawURL = import.meta.env.VITE_API_URL;

// Throw error if missing in production, fallback only in development
if (!rawURL) {
  if (import.meta.env.MODE === "production") {
    throw new Error("[CRITICAL] VITE_API_URL is not defined in environment.");
  }
  rawURL = "http://localhost:8001/api";
}

// Standardization Logic: remove trailing slash and ensure /api exists
let baseURL = rawURL.replace(/\/$/, "");
if (!baseURL.endsWith("/api")) {
  baseURL += "/api";
}

const PUBLIC_PREFIXES = ["/config", "/products", "/reviews", "/auth", "/orders/check-review"];

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const getAuthToken = () => {
  try {
    const auth = localStorage.getItem("auth-storage");
    if (auth) {
      const parsed = JSON.parse(auth);
      return parsed.state?.token || null;
    }
    return localStorage.getItem("token");
  } catch (err) {
    return null;
  }
};

const getAdminToken = () => localStorage.getItem("adminToken");

api.interceptors.request.use(
  (config) => {
    const rawUrl = String(config?.url || "");
    const reqUrl = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
    
    const onAdminPage = window.location.pathname.startsWith("/admin");
    const isAdminRoute = reqUrl.startsWith("/admin") || reqUrl.includes("/admin/") || reqUrl.startsWith("/upload");
    
    // Recovery: Try all possible token locations
    const adminToken = localStorage.getItem("adminToken");
    const userToken = getAuthToken() || localStorage.getItem("token");
    
    // Prioritize adminToken for admin context
    const token = (onAdminPage || isAdminRoute) ? (adminToken || userToken) : userToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (isAdminRoute && import.meta.env.MODE === "development") {
      // Only warn for protected administrative endpoints in dev
      console.warn(`[client] Missing admin credentials for: ${reqUrl}`);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "success")) {
      if (body.success === false) {
        return Promise.reject({
          response: { data: body, status: response.status },
          isApiError: true,
        });
      }
      if (body.data !== undefined) return body.data;
      return body;
    }
    return body;
  },
  (error) => {
    const rawUrl = String(error?.config?.url || "");
    const reqUrl = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
    const isAdminRequest = reqUrl.startsWith("/admin");
    const isAuthFlowRequest =
      reqUrl.includes("/auth/login") ||
      reqUrl.includes("/auth/admin-login") ||
      reqUrl.includes("/auth/register") ||
      reqUrl.includes("/auth/verify-") ||
      reqUrl.includes("/auth/request-login-otp");

    const status = error.response?.status;
    const data = error.response?.data;
    let message = (data && data.message) || error.message || "An unexpected error occurred.";

    // Handle 521 (Service Unavailable / Down) specifically
    if (status === 521) {
      message = "The backend service is currently down or restarting. Please try again in 30 seconds.";
    }

    // Handle specific network-level failures (DNS, no internet, CORS blocks)
    if (!error.response || error.code === "ERR_NETWORK" || error.message === "Network Error") {
      message = "Server unreachable. This might be a temporary deployment restart or a network issue.";
      if (import.meta.env.MODE === "development") {
        console.error("[Network Error Diagnostic]: Check if backend is running on port 8001");
      }
    } else if (error.code === "ECONNABORTED") {
      message = "Request timed out. The server is taking too long to respond.";
    }

    if (status === 401) {
      const isTokenMissing = !getAuthToken() && !getAdminToken();
      const isExpired = data?.code === "TOKEN_EXPIRED" || data?.message?.toLowerCase().includes("expired");

      if (!isAuthFlowRequest && (isTokenMissing || isExpired)) {
        if (isAdminRequest || window.location.pathname.startsWith("/admin")) {
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
          if (window.location.pathname !== "/admin/login") {
            window.location.href = "/admin/login";
          }
        } else {
          localStorage.removeItem("auth-storage");
          localStorage.removeItem("token");
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      }
    } else if (status === 403) {
      if (!isAuthFlowRequest) toast.error("Unauthorized access restricted.");
    } else if (status === 404) {
      // toast.error("Resource not found."); // redundant for missing items
    } else if (status >= 500) {
      toast.error(message || translateError("internal server error"));
    } else {
      const isPublicRoute = PUBLIC_PREFIXES.some(prefix => reqUrl.startsWith(prefix));
      if (!isPublicRoute) toast.error(translateError(message));
    }

    return Promise.reject(error);
  }
);
