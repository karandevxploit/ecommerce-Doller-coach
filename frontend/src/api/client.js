import axios from "axios";

const getRuntimeApiUrl = () => {
  const configured = import.meta.env.VITE_API_URL || "";
  const normalizedConfigured = String(configured || "").trim().replace(/\/+$/, "");

  if (typeof window === "undefined") return normalizedConfigured;
  if (!normalizedConfigured) return "";

  try {
    const configuredUrl = new URL(normalizedConfigured, window.location.origin);
    const isConfiguredLocal =
      configuredUrl.hostname === "localhost" ||
      configuredUrl.hostname === "127.0.0.1" ||
      configuredUrl.hostname === "::1";
    const isCurrentLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";

    if (isConfiguredLocal && !isCurrentLocal) return "";
    return configuredUrl.origin;
  } catch {
    return normalizedConfigured;
  }
};

const RAW_API_URL = getRuntimeApiUrl();
const API_BASE_URL = RAW_API_URL
  ? `${RAW_API_URL.replace(/\/+$/, "")}/api`
  : "/api";
const API_TIMEOUT_MS = 20000;

let accessToken =
  typeof localStorage !== "undefined" ? localStorage.getItem("token") || null : null;

let refreshPromise = null;

export const clearAuth = () => {
  accessToken = null;

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
  }
};

export const setAccessToken = (token) => {
  accessToken = token || null;

  if (typeof localStorage === "undefined") return;

  if (token) {
    localStorage.setItem("token", token);
  } else {
    clearAuth();
  }
};

export const getAccessToken = () => accessToken;

export const isCancelledRequest = (error) => {
  return (
    axios.isCancel(error) ||
    error?.code === "ERR_CANCELED" ||
    error?.name === "CanceledError" ||
    error?.name === "AbortError"
  );
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh-token", null, {
        __skipAuthRefresh: true,
        __skipRetry: true,
      })
      .then((res) => {
        const payload = res?.data?.data || res?.data || {};
        const token = payload?.accessToken || payload?.token;

        if (!token || typeof token !== "string") {
          throw new Error("Invalid refresh response");
        }

        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const inFlightRequests = new Set();
const pendingGetControllers = new Map();

const stableStringify = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const buildRequestKey = (config = {}) => {
  const method = (config.method || "get").toUpperCase();
  const url = config.url || "";
  const params = stableStringify(config.params || {});
  const data = stableStringify(config.data || {});

  return `${method}:${url}:${params}:${data}`;
};

const releaseRequestLocks = (config = {}) => {
  if (config.__requestKey) {
    inFlightRequests.delete(config.__requestKey);
  }

  if (config.__isTrackedGet && config.__requestKey) {
    const controller = pendingGetControllers.get(config.__requestKey);

    if (!controller || controller === config.__internalController) {
      pendingGetControllers.delete(config.__requestKey);
    }
  }
};

export const apiCall = async (fn) => {
  try {
    const res = await fn();

    return {
      success: res?.data?.success ?? true,
      data: res?.data?.data ?? res?.data ?? null,
      message: res?.data?.message || "",
    };
  } catch (err) {
    if (isCancelledRequest(err)) {
      return {
        success: false,
        canceled: true,
        message: "Request cancelled",
        data: null,
      };
    }

    return {
      success: false,
      message:
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong",
      data: err?.response?.data?.data || null,
    };
  }
};

export const safeApi = {
  get: (url, config) => apiCall(() => api.get(url, config)),
  post: (url, data, config) => apiCall(() => api.post(url, data, config)),
  put: (url, data, config) => apiCall(() => api.put(url, data, config)),
  patch: (url, data, config) => apiCall(() => api.patch(url, data, config)),
  delete: (url, config) => apiCall(() => api.delete(url, config)),
};

api.interceptors.request.use(
  (config) => {
    const token =
      accessToken ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null);

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = (config.method || "get").toUpperCase();
    const requestKey = buildRequestKey(config);
    const isGet = method === "GET";

    config.__requestKey = requestKey;
    config.metadata = {
      ...(config.metadata || {}),
      startedAt: Date.now(),
    };

    if (isGet && !config.signal) {
      const controller = new AbortController();
      config.signal = controller.signal;
      config.__internalController = controller;
      config.__isTrackedGet = true;
      pendingGetControllers.set(requestKey, controller);
    }

    if (!isGet) {
      if (inFlightRequests.has(requestKey)) {
        return Promise.reject(
          new axios.Cancel("Duplicate in-flight request suppressed")
        );
      }

      inFlightRequests.add(requestKey);
    }

    console.info("[API_REQUEST]", method, config.url || "", config.params || {});

    return config;
  },
  (error) => {
    console.error("API_REQUEST_ERROR:", error?.message || error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    releaseRequestLocks(response?.config);

    const startedAt = response?.config?.metadata?.startedAt || Date.now();

    console.info(
      "[API_RESPONSE]",
      (response?.config?.method || "get").toUpperCase(),
      response?.config?.url || "",
      response?.status,
      `${Date.now() - startedAt}ms`
    );

    return response;
  },
  async (error) => {
    const config = error?.config || {};
    releaseRequestLocks(config);

    if (isCancelledRequest(error)) {
      return Promise.reject(error);
    }

    console.error(
      "FULL_API_ERROR_OBJECT:",
      error,
      "\n[API_ERROR_SUMMARY]",
      (config.method || "get").toUpperCase(),
      config.url || "",
      error?.response?.status || "NETWORK",
      error?.response?.data || error?.message
    );

    const method = (config.method || "get").toUpperCase();
    const shouldRetry =
      method === "GET" &&
      !config.__skipRetry &&
      (!error.response ||
        error.code === "ECONNABORTED" ||
        (error.response?.status >= 500 && error.response?.status < 600));

    if (shouldRetry) {
      config.__retryCount = config.__retryCount || 0;

      if (config.__retryCount < 1) {
        config.__retryCount += 1;
        config.__skipRetry = false;

        await new Promise((resolve) => {
          setTimeout(resolve, 250 * config.__retryCount);
        });

        return api(config);
      }
    }

    if (!error.response) {
      const normalized = new Error(
        `Backend service is unreachable. Please ensure API server is running on ${RAW_API_URL}.`
      );

      normalized.cause = error;
      normalized.code = "BACKEND_UNREACHABLE";

      return Promise.reject(normalized);
    }

    if (
      error.response?.status === 401 &&
      !config.__skipAuthRefresh &&
      !config.__isRetryAfterRefresh
    ) {
      const requestUrl = config.url || "";
      const isAuthRequest = [
        "/auth/login",
        "/auth/register",
        "/auth/admin-login",
        "/auth/refresh-token",
        "/auth/verify-otp",
        "/auth/resend-otp",
        "/auth/request-login-otp",
      ].some((path) => requestUrl.includes(path));

      if (!isAuthRequest) {
        try {
          const token = await refreshAccessToken();
          config.__isRetryAfterRefresh = true;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        } catch {
          clearAuth();
        }
      }
    }

    if (error.response?.status === 401 && typeof window !== "undefined") {
      const requestUrl = error.config?.url || "";
      const currentPath = window.location.pathname || "";

      const isAuthRoute = [
        "/login",
        "/register",
        "/auth/login",
        "/auth/register",
        "/auth/me",
        "/admin/login",
      ].some((path) => currentPath.includes(path) || requestUrl.includes(path));

      if (!isAuthRoute) {
        clearAuth();

        const isAdminRoute = currentPath.startsWith("/admin");
        window.location.href = isAdminRoute ? "/admin/login" : "/login";
      }
    }

    return Promise.reject(error);
  }
);

export { api };
