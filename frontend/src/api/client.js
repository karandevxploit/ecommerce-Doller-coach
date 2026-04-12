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
const NON_REFRESHABLE_PATHS = ["/auth/login", "/auth/register", "/auth/refresh-token", "/auth/google", "/auth/verify-otp", "/auth/reset-password", "/auth/profile", "/admin/stats"];

// 2. Request Management System
const inflightRequests = new Map();
const requestHistory = new Map();
const THROTTLE_LIMIT = 10; 
const THROTTLE_WINDOW = 5000; // 5 seconds

// 3. Circuit Breaker System
let circuitOpen = false;
let failureCount = 0;
let lastFailureAt = 0;
const TRIP_THRESHOLD = 5;
const TRIP_WINDOW = 20000; // 20s
const COOLDOWN = 30000; // 30s

const checkCircuit = () => {
  if (circuitOpen) {
    if (Date.now() - lastFailureAt > COOLDOWN) {
      console.log("[CIRCUIT] Cooldown over. Resetting circuit.");
      circuitOpen = false;
      failureCount = 0;
      return true;
    }
    return false;
  }
  return true;
};

const recordFailure = () => {
  const now = Date.now();
  if (now - lastFailureAt > TRIP_WINDOW) {
    failureCount = 1;
  } else {
    failureCount++;
  }
  lastFailureAt = now;
  if (failureCount >= TRIP_THRESHOLD) {
    circuitOpen = true;
    toast.error("System instability detected. Emergency Circuit Breaker tripped. Pausing requests.");
  }
};

// Loop Arrestor: Prevents rapid reloads
const checkLoopArrestor = (targetUrl) => {
  const currentPath = window.location.pathname;
  if (targetUrl && currentPath === targetUrl) return false; // Already there, don't reload

  const lastReload = sessionStorage.getItem("last_reload_timestamp");
  const now = Date.now();
  
  if (lastReload && now - parseInt(lastReload) < 2000) { // 2s safeguard (relaxed from 10s)
    console.error("[CRITICAL] Rapid reload loop detected. arrest execution.");
    return false;
  }
  
  sessionStorage.setItem("last_reload_timestamp", now.toString());
  return true;
};

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (!checkCircuit()) {
    console.warn(`[CIRCUIT] Blocking request to ${config.url} due to open circuit.`);
    return Promise.reject(new Error("Circuit Breaker Open"));
  }

  // Inject Bearer Token from local storage if available
  try {
    const rawStorage = localStorage.getItem("auth-storage");
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage);
      const token = parsed?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.error("Auth header injection failed", err);
  }

  return config;
});

// Wrap GET requests for deduplication and throttling
const originalGet = api.get;
api.get = (url, config) => {
  if (!checkCircuit()) {
    return Promise.reject(new Error("Circuit Breaker Open"));
  }
  const now = Date.now();
  const key = `${url}${JSON.stringify(config?.params || {})}`;

  // 1. Throttling Check
  const timestamps = (requestHistory.get(url) || []).filter(t => now - t < THROTTLE_WINDOW);
  if (timestamps.length >= THROTTLE_LIMIT) {
    console.warn(`[THROTTLE] Excessive requests to ${url}. Blocking call.`);
    return Promise.reject(new Error("Request Throttled"));
  }
  requestHistory.set(url, [...timestamps, now]);

  // 2. Deduplication Check
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const promise = originalGet.call(api, url, config).finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, promise);
  return promise;
};

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
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const data = error.response?.data;
    let message = (data && data.message) || error.message || "An unexpected error occurred.";

    // 1. Handle Token Expiry (Automatic Refresh)
    const url = originalRequest.url || "";
    // These paths should NEVER trigger a refresh loop
    const isRefreshable = !NON_REFRESHABLE_PATHS.some(p => url.includes(p));

    if (status === 401 && !originalRequest._retry && isRefreshable) {
      originalRequest._retry = true;
      try {
        await axios.post(`${baseURL}/auth/refresh-token`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Session expired, cleaning up local state...");
        
        const isAdminRequest = url.includes("/admin");
        const targetUrl = isAdminRequest ? "/admin/login" : "/login";

        // FAIL-SAFE: Check loop arrestor before allowing redirect
        if (checkLoopArrestor(targetUrl)) {
          if (isAdminRequest) {
            localStorage.removeItem("adminUser");
            window.location.href = targetUrl;
          } else {
            localStorage.removeItem("auth-storage");
            window.location.href = targetUrl;
          }
        }
        
        return Promise.reject(refreshError);
      }
    }

    const errorCode = data?.errorCode || "UNEXPECTED_FAILURE";
    const requestId = data?.requestId || "N/A";

    if (status >= 500 || !error.response || error.code === "ERR_NETWORK") {
      recordFailure();
    }

    // 2. Handle Validation Failures
    if (errorCode === "VALIDATION_FAILED" && data?.errors) {
      const fieldErrors = Object.entries(data.errors)
        .map(([_, msg]) => `• ${msg}`)
        .join("\n");
      toast.error(`Input Validation Failed:\n${fieldErrors}`, { duration: 5000 });
    } else if (status === 429) {
      toast.error("Too many requests. Please slow down.");
    } else if (status === 521) {
      toast.error("Server is currently restarting. Please try again in 30 seconds.");
    } else if (status >= 500) {
      toast.error(`A system error occurred. (Ref: ${requestId})`, { 
        duration: 8000,
        position: "bottom-right"
      });
    } else if (!error.response || error.code === "ERR_NETWORK") {
      toast.error("Server unreachable. Please check your connection.");
    } else {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);
