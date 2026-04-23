/**
 * IMAGE URL RESOLVER (Cloudinary + Production Ready)
 * - Handles absolute, relative, array, object formats
 * - Adds Cloudinary optimizations
 * - SSR safe
 * - Prevents broken images
 */

/* ---------------- FALLBACK ---------------- */
const INTERNAL_FALLBACK =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNTAwIiB2aWV3Qm94PSIwIDAgNDAwIDUwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI1MDAiIGZpbGw9IiNmMWY1ZjkiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tk8gSU1BR0U8L3RleHQ+PC9zdmc+";

/* ---------------- ENV SAFE ---------------- */
const getServerUrl = () => {
  try {
    const base =
      import.meta?.env?.VITE_API_URL ||
      "http://localhost:8001/api";
    return base.replace("/api", "");
  } catch {
    return "";
  }
};

/* ---------------- VALID URL ---------------- */
const isValidUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("http://") ||
    url.startsWith("https://"));

/* ---------------- CLOUDINARY OPTIMIZER ---------------- */
const optimizeCloudinary = (url) => {
  if (!url.includes("res.cloudinary.com")) return url;

  // Add automatic optimization if not already present
  if (url.includes("/upload/") && !url.includes("f_auto")) {
    return url.replace(
      "/upload/",
      "/upload/f_auto,q_auto/"
    );
  }

  return url;
};

/* ---------------- MAIN RESOLVER ---------------- */
export const resolveImageUrl = (input) => {
  if (!input) return INTERNAL_FALLBACK;

  let path = input;

  /* ---------- ARRAY SUPPORT ---------- */
  if (Array.isArray(input)) {
    path = input.find(isValidUrl) || input[0];
  }

  /* ---------- OBJECT SUPPORT ---------- */
  if (typeof path === "object" && path !== null) {
    path = path.url || path.secure_url || "";
  }

  if (!path) return INTERNAL_FALLBACK;

  /* ---------- ABSOLUTE URL ---------- */
  if (isValidUrl(path)) {
    return optimizeCloudinary(path);
  }

  /* ---------- RELATIVE PATH ---------- */
  const server = getServerUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  
  return server
    ? `${server}${normalizedPath}`
    : INTERNAL_FALLBACK;
};

/* ---------------- VIDEO POSTER ---------------- */
export const getVideoPoster = (url) => {
  if (!url) return INTERNAL_FALLBACK;
  if (!url.includes("res.cloudinary.com")) return INTERNAL_FALLBACK;

  // Cloudinary trick: Change extension to .jpg and add so_auto (start offset auto)
  return url
    .replace(/\.[^/.]+$/, ".jpg")
    .replace("/upload/", "/upload/f_auto,q_auto,so_auto/");
};

/* ---------------- IMAGE ERROR HANDLER ---------------- */
export const handleImageError = (e) => {
  if (!e?.target) return;

  if (e.target.dataset.fallback) return;

  e.target.src = INTERNAL_FALLBACK;
  e.target.dataset.fallback = "true";
};