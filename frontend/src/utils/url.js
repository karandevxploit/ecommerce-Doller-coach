/**
 * IMAGE URL RESOLVER (Local uploads + Production Ready)
 * - Handles absolute, relative, array, object formats
 * - SSR safe
 * - Prevents broken images
 */

/* ---------------- FALLBACK ---------------- */
export const INTERNAL_FALLBACK = "/uploads/products/default-product.webp";

/* ---------------- ENV SAFE ---------------- */
export const getServerUrl = () => {
  try {
    const configured =
      import.meta?.env?.VITE_PUBLIC_BACKEND_URL ||
      import.meta?.env?.VITE_API_URL ||
      "";
    const normalizedConfigured = String(configured || "")
      .trim()
      .replace(/\/api\/?$/, "")
      .replace(/\/$/, "");

    if (typeof window === "undefined") {
      return normalizedConfigured || "";
    }

    const currentOrigin = window.location.origin;
    const currentHost = window.location.hostname;
    const isCurrentLocal =
      currentHost === "localhost" ||
      currentHost === "127.0.0.1" ||
      currentHost === "::1";

    if (normalizedConfigured) {
      const configuredUrl = new URL(normalizedConfigured, currentOrigin);
      const configuredHost = configuredUrl.hostname;
      const isConfiguredLocal =
        configuredHost === "localhost" ||
        configuredHost === "127.0.0.1" ||
        configuredHost === "::1";

      if (!isConfiguredLocal || isCurrentLocal) {
        return configuredUrl.origin;
      }
    }

    return currentOrigin;
  } catch {
    return "";
  }
};

/* ---------------- VALID URL ---------------- */
export const isValidUrl = (url) => {
  if (typeof url !== "string") return false;

  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:image/") ||
    url.startsWith("blob:")
  );
};

/* ---------------- EXTRACT URL FROM INPUT ---------------- */
export const extractUrl = (input) => {
  if (!input) return "";

  if (typeof input === "string") return input.trim();

  if (Array.isArray(input)) {
    const firstUsable =
      input.find((item) => isValidUrl(extractUrl(item))) ||
      input.find(Boolean);

    return extractUrl(firstUsable);
  }

  if (typeof input === "object") {
    return (
      input.url ||
      input.secure_url ||
      input.imageUrl ||
      input.src ||
      input.path ||
      input.thumbnail ||
      input.preview ||
      ""
    );
  }

  return "";
};

/* ---------------- STATIC / LOCAL ASSET ---------------- */
const isStaticAsset = (path) => {
  if (typeof path !== "string") return false;

  return (
    path.startsWith("/src/") ||
    path.startsWith("/@fs/") ||
    path.startsWith("/assets/") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  );
};

/* ---------------- MAIN RESOLVER ---------------- */
export const resolveImageUrl = (input) => {
  const rawPath = extractUrl(input);

  if (!rawPath) return INTERNAL_FALLBACK;

  const path = String(rawPath).trim();

  if (!path) return INTERNAL_FALLBACK;

  if (path.startsWith("/placeholder")) return INTERNAL_FALLBACK;

  /* ---------- ABSOLUTE URL / DATA / BLOB ---------- */
  if (isValidUrl(path)) {
    try {
      const parsed = new URL(path);
      const isLocalBackend =
        (parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "::1") &&
        parsed.pathname.startsWith("/uploads/");

      if (isLocalBackend) {
        const server = getServerUrl();
        return server ? `${server}${parsed.pathname}${parsed.search}` : parsed.pathname;
      }
    } catch {
      // Fall through to original URL handling.
    }

    return path;
  }

  /* ---------- VITE / PUBLIC ASSET ---------- */
  if (isStaticAsset(path)) {
    return path;
  }

  /* ---------- LOCAL UPLOADS ---------- */
  if (path.startsWith("/uploads/")) {
    const server = getServerUrl();
    return server ? `${server}${path}` : path;
  }
  if (path.startsWith("uploads/")) {
    const server = getServerUrl();
    return server ? `${server}/${path}` : `/${path}`;
  }

  /* ---------- RELATIVE PATH (BACKEND) ---------- */
  const server = getServerUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return server ? `${server}${normalizedPath}` : INTERNAL_FALLBACK;
};

export const FALLBACK_IMAGE_URL = resolveImageUrl(INTERNAL_FALLBACK);

/* ---------------- VIDEO URL RESOLVER ---------------- */
export const resolveVideoUrl = (input) => {
  const rawPath = extractUrl(input);

  if (!rawPath) return "";

  const path = String(rawPath).trim();

  if (isValidUrl(path)) {
    try {
      const parsed = new URL(path);
      const isLocalBackend =
        (parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "::1") &&
        parsed.pathname.startsWith("/uploads/");

      if (isLocalBackend) {
        const server = getServerUrl();
        return server ? `${server}${parsed.pathname}${parsed.search}` : parsed.pathname;
      }
    } catch {
      // Fall through to original URL handling.
    }

    return path;
  }

  const server = getServerUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return server ? `${server}${normalizedPath}` : "";
};

/* ---------------- VIDEO POSTER ---------------- */
export const getVideoPoster = (input) => {
  const url = resolveVideoUrl(input);

  if (!url) return FALLBACK_IMAGE_URL;

  return FALLBACK_IMAGE_URL;
};

/* ---------------- IMAGE ERROR HANDLER ---------------- */
export const handleImageError = (e) => {
  const target = e?.currentTarget || e?.target;
  if (!target) return;

  if (target.dataset.fallback === "true") return;

  target.dataset.fallback = "true";
  target.src = FALLBACK_IMAGE_URL;
};

export default resolveImageUrl;
