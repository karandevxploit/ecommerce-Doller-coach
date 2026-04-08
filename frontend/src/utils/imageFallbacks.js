/**
 * Premium Image Fallbacks for Luxury Aesthetic
 */

export const MEN_PREMIUM = "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=800&auto=format&fit=crop";
export const WOMEN_PREMIUM = "https://images.unsplash.com/photo-1539109132381-381005a4c8f5?q=80&w=800&auto=format&fit=crop";

/**
 * Returns a category-specific fallback image
 * @param {string} category - "MEN" or "WOMEN"
 * @returns {string} - Premium Unsplash URL
 */
export const getCategoryFallback = (category) => {
  if (category?.toUpperCase() === "WOMEN") return WOMEN_PREMIUM;
  return MEN_PREMIUM;
};
