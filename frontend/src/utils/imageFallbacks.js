/**
 * Simple & Strict Image Fallback (Men / Women Only)
 */

/* ---------------- DEFAULTS ---------------- */
export const FALLBACKS = {
  men: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800&auto=format&fit=crop",
  women: "https://images.unsplash.com/photo-1539109132381-381005a4c8f5?q=80&w=800&auto=format&fit=crop",
};

/* ---------------- NORMALIZE ---------------- */
const normalize = (value = "") =>
  String(value).toLowerCase().trim();

/* ---------------- CATEGORY FALLBACK ---------------- */
export const getCategoryFallback = (category) => {
  const key = normalize(category);

  if (key.includes("women")) return FALLBACKS.women;

  return FALLBACKS.men; // default = men
};

/* ---------------- SAFE IMAGE ---------------- */
export const getSafeImage = (image, category) => {
  if (
    typeof image === "string" &&
    image.startsWith("http")
  ) {
    return image;
  }

  return getCategoryFallback(category);
};

/* ---------------- ERROR HANDLER ---------------- */
export const handleImageError = (e, category) => {
  if (!e?.target) return;

  const fallback = getCategoryFallback(category);

  if (e.target.src !== fallback) {
    e.target.src = fallback;
  }
};