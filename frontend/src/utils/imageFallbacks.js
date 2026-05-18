/**
 * Simple & Strict Image Fallback
 */

/* ---------------- DEFAULTS ---------------- */
export const FALLBACKS = {
  men: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800&auto=format&fit=crop",
  women: "https://images.unsplash.com/photo-1539109132381-381005a4c8f5?q=80&w=800&auto=format&fit=crop",
  accessories:
    "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=800&auto=format&fit=crop",
  default:
    "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800&auto=format&fit=crop",
};

/* ---------------- NORMALIZE ---------------- */
const normalize = (value = "") => {
  if (value && typeof value === "object") {
    return String(
      value.name ||
      value.title ||
      value.label ||
      value.slug ||
      value.main ||
      ""
    )
      .toLowerCase()
      .trim();
  }

  return String(value || "").toLowerCase().trim();
};

/* ---------------- URL CHECK ---------------- */
const isUsableImage = (image) => {
  if (typeof image !== "string") return false;

  const value = image.trim();
  if (!value) return false;

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:image/") ||
    value.startsWith("blob:")
  );
};

/* ---------------- CATEGORY FALLBACK ---------------- */
export const getCategoryFallback = (category) => {
  const key = normalize(category);

  if (key.includes("women") || key.includes("female") || key.includes("girl")) {
    return FALLBACKS.women;
  }

  if (
    key.includes("access") ||
    key.includes("watch") ||
    key.includes("bag") ||
    key.includes("glass")
  ) {
    return FALLBACKS.accessories;
  }

  return FALLBACKS.men || FALLBACKS.default;
};

/* ---------------- SAFE IMAGE ---------------- */
export const getSafeImage = (image, category) => {
  if (isUsableImage(image)) {
    return image.trim();
  }

  return getCategoryFallback(category);
};

/* ---------------- ERROR HANDLER ---------------- */
export const handleImageError = (e, category) => {
  const target = e?.currentTarget || e?.target;
  if (!target) return;

  const fallback = getCategoryFallback(category);

  if (target.dataset.fallbackApplied === "true") return;

  target.dataset.fallbackApplied = "true";
  target.src = fallback;
};
