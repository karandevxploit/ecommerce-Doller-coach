/**
 * Centralized utility exports
 * Optimized for tree-shaking + consistency
 */

/* ---------------- PRICE ---------------- */
export {
    formatPrice,
    normalizePrice,
    formatNumber,
    calculateDiscount,
    safeAdd,
} from "./format";

/* ---------------- IMAGES ---------------- */
export {
    getCategoryFallback,
    getSafeImage,
    handleImageError,
} from "./imageFallbacks";

/* ---------------- ANIMATIONS ---------------- */
export { motionVariants } from "./motion";

/* ---------------- SANITIZATION ---------------- */
export { sanitizeInput } from "./sanitizer";

/* ---------------- ERROR HANDLING ---------------- */
export { userFriendlyErrors } from "./userFriendlyErrors";

/* ---------------- VALIDATION ---------------- */
export { validationRules } from "./validation";