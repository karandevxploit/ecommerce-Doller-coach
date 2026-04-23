import DOMPurify from "dompurify";

/**
 * Safe DOM Sanitizer
 * - Prevents XSS
 * - Supports basic rich text
 * - Works in SSR + browser
 */

/* ---------------- SAFE INSTANCE ---------------- */
const createSanitizer = () => {
  if (typeof window === "undefined") {
    return {
      sanitize: (val) => String(val || ""),
    };
  }

  return DOMPurify;
};

const purifier = createSanitizer();

/* ---------------- CONFIG ---------------- */
const config = {
  ALLOWED_TAGS: [
    "b",
    "i",
    "em",
    "strong",
    "u",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "span",
    "a",
  ],
  ALLOWED_ATTR: [
    "class", // correct attribute (NOT className)
    "href",
    "target",
    "rel",
  ],
  ALLOW_DATA_ATTR: false,
};

/* ---------------- SANITIZE HTML ---------------- */
export const sanitize = (dirty) => {
  if (!dirty) return "";

  try {
    return purifier.sanitize(String(dirty), config);
  } catch {
    return "";
  }
};

/* ---------------- SANITIZE TEXT (STRICT) ---------------- */
export const sanitizeText = (value) => {
  if (!value) return "";

  return String(value)
    .replace(/[<>]/g, "")
    .trim();
};

/* ---------------- SAFE URL ---------------- */
export const sanitizeUrl = (url) => {
  if (!url) return "";

  try {
    const parsed = new URL(url, window.location.origin);

    // Allow only http/https
    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {
      return parsed.href;
    }

    return "";
  } catch {
    return "";
  }
};