/* =========================================================
   FORMAT PRICE (INR DEFAULT)
========================================================= */
export const formatPrice = (
  amount = 0,
  options = {}
) => {
  const {
    currency = "INR",
    locale = "en-IN",
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  } = options;

  const safeAmount = Number(amount);

  if (isNaN(safeAmount)) {
    return "₹0";
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(safeAmount);
  } catch {
    // fallback (never break UI)
    return `₹${Math.round(safeAmount)}`;
  }
};

/* =========================================================
   NORMALIZE AMOUNT (FOR STORAGE / CALCULATION)
========================================================= */
export const normalizePrice = (value) => {
  const num = Number(value);

  if (isNaN(num) || num < 0) return 0;

  return Math.round(num);
};

/* =========================================================
   OPTIONAL: FORMAT WITHOUT SYMBOL
========================================================= */
export const formatNumber = (
  value = 0,
  locale = "en-IN"
) => {
  const num = Number(value);

  if (isNaN(num)) return "0";

  return new Intl.NumberFormat(locale).format(num);
};

/* =========================================================
   OPTIONAL: DISCOUNT CALCULATOR
========================================================= */
export const calculateDiscount = (
  price,
  originalPrice
) => {
  const p = Number(price);
  const op = Number(originalPrice);

  if (!p || !op || op <= p) return 0;

  return Math.round(((op - p) / op) * 100);
};

/* =========================================================
   OPTIONAL: SAFE ADD (FLOAT BUG FIX)
========================================================= */
export const safeAdd = (...numbers) => {
  return numbers.reduce(
    (acc, num) =>
      acc + (Number(num) || 0),
    0
  );
};