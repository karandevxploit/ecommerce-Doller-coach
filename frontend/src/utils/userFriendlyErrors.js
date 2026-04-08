/**
 * Professional Error Translation Dictionary
 * Maps technical backend/database messages to premium consumer-facing copy.
 * Consistent with the "Doller Coach" brand: Precision. Power. Prestige.
 */

const errorMap = {
  // Authentication & Security
  "invalid email or password": "We couldn't verify your credentials. Please double-check and try again.",
  "user not found": "We couldn't find an account matching these details.",
  "password incorrect": "The password entered is incorrect. Please try again or reset your access.",
  "jwt expired": "Current session has timed out for your security. Please sign in again.",
  "unauthorized": "Secure access required. Please authenticate to proceed.",
  "invalid token": "Security validation failed. Please sign in again.",
  "admin access only": "Administrative privileges required to access this terminal.",
  "access denied": "You do not have the necessary permissions for this action.",
  
  // Registration & Validation
  "user already exists": "An account is already associated with this email address.",
  "invalid otp": "The verification code entered doesn't match our records. Please verify and try again.",
  "otp expired": "This verification code has expired. Please request a new one.",
  "invalid email": "Please provide a valid corporate or personal email address.",
  "password must be 6+ characters": "For your protection, passwords must be at least 6 characters long.",
  
  // Checkout & Product
  "no products in order": "Your manifest is empty. Please select items for purchase before checkout.",
  "insufficient stock": "We apologize, but one or more items in your cart are no longer available in the requested quantity.",
  "invalid coupon": "This privilege code is either invalid or has reached its usage limit.",
  "min order value": "A minimum order value is required to apply this specific discount.",
  "coupon expired": "This privilege code is no longer active.",
  
  // System & Infrastructure
  "network error": "We're experiencing a brief connectivity delay. Please check your signal.",
  "internal server error": "System Maintenance: Our engineers are optimizing the experience. Please try again shortly.",
  "service unavailable": "High Traffic: We are currently managing a high volume of requests. Please stand by.",
  "request failed": "An unexpected interruption occurred. Our team has been notified."
};

/**
 * Translates a technical error message into a user-friendly string.
 * @param {string} rawMsg - The raw message from the backend or Axios error.
 * @returns {string} - A polished, premium error message.
 */
export const translateError = (rawMsg) => {
  if (!rawMsg) return "An unexpected error occurred. Please try again.";
  
  const normalized = String(rawMsg).toLowerCase().trim();
  
  // Check for exact matches first
  if (errorMap[normalized]) return errorMap[normalized];
  
  // Check for partial matches (substrings)
  for (const [key, value] of Object.entries(errorMap)) {
    if (normalized.includes(key)) return value;
  }
  
  // Fallback for Mongoose ValidationError or multi-error strings
  if (normalized.includes(",")) {
    return "Validation failed: Please ensure all required fields are correctly formatted.";
  }
  
  // Return the raw message if it's already somewhat descriptive, 
  // otherwise use a generic premium fallback.
  return rawMsg.length > 3 && rawMsg.length < 100 
    ? rawMsg 
    : "The system encountered an interruption. Please refresh and try again.";
};
