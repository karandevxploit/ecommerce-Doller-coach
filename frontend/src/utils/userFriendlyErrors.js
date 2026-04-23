/**
 * User-Friendly Error Translator
 * - Clean, clear, real-world language
 * - Handles Axios + backend + unknown errors
 * - Supports status codes + message matching
 */

/* ---------------- MESSAGE MAP ---------------- */
const errorMap = {
  // Auth
  "invalid email or password": "Incorrect email or password. Please try again.",
  "user not found": "No account found with this email.",
  "password incorrect": "Incorrect password. Please try again.",
  "jwt expired": "Session expired. Please log in again.",
  "unauthorized": "Please log in to continue.",
  "invalid token": "Session expired. Please log in again.",
  "access denied": "You don’t have permission to perform this action.",

  // Signup / OTP
  "user already exists": "This email is already registered.",
  "invalid otp": "Invalid verification code. Please try again.",
  "otp expired": "Verification code expired. Request a new one.",
  "invalid email": "Please enter a valid email address.",
  "password must be 6": "Password must be at least 6 characters.",

  // Cart / Orders
  "no products in order": "Your cart is empty.",
  "insufficient stock": "Some items are out of stock or limited in quantity.",
  "invalid coupon": "Invalid or expired coupon code.",
  "min order value": "Order does not meet minimum value for this offer.",
  "coupon expired": "This coupon has expired.",

  // System
  "network error": "Network issue. Please check your connection.",
  "internal server error": "Something went wrong. Please try again.",
  "service unavailable": "Service is temporarily unavailable. Please try again.",
  "request failed": "Request failed. Please try again.",
};

/* ---------------- STATUS CODE MAP ---------------- */
const statusMap = {
  400: "Invalid request. Please check your input.",
  401: "Please log in to continue.",
  403: "You don’t have permission to do this.",
  404: "Requested resource not found.",
  429: "Too many requests. Please wait and try again.",
  500: "Server error. Please try again later.",
};

/* ---------------- EXTRACT ERROR MESSAGE ---------------- */
const extractMessage = (error) => {
  if (!error) return "";

  // Axios response
  if (error?.response?.data) {
    return (
      error.response.data.message ||
      error.response.data.error ||
      ""
    );
  }

  // Native error
  if (error?.message) return error.message;

  // String
  if (typeof error === "string") return error;

  return "";
};

/* ---------------- MAIN TRANSLATOR ---------------- */
export const translateError = (error) => {
  const rawMsg = extractMessage(error);
  const normalized = rawMsg.toLowerCase().trim();

  /* ---------- STATUS CODE ---------- */
  const status = error?.response?.status;
  if (status && statusMap[status]) {
    return statusMap[status];
  }

  /* ---------- EXACT MATCH ---------- */
  if (errorMap[normalized]) {
    return errorMap[normalized];
  }

  /* ---------- PARTIAL MATCH ---------- */
  for (const key in errorMap) {
    if (normalized.includes(key)) {
      return errorMap[key];
    }
  }

  /* ---------- MULTIPLE ERRORS ---------- */
  if (normalized.includes(",") || normalized.includes("validation")) {
    return "Please check your input and try again.";
  }

  /* ---------- FALLBACK ---------- */
  if (rawMsg && rawMsg.length < 120) {
    return rawMsg;
  }

  return "Something went wrong. Please try again.";
};