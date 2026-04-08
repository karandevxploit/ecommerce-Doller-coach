/**
 * Format a rupee amount (backend stores prices in INR).
 */
export const formatPrice = (amountInr) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amountInr) || 0);
};

export const convertToINR = (n) => Math.round(Number(n) || 0);
