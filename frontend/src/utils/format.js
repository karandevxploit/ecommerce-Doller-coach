const DEFAULT_LOCALE = "en-IN";
const DEFAULT_CURRENCY = "INR";

const toNumber = (value, fallback = 0) => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/* =========================================================
   FORMAT PRICE (INR DEFAULT)
========================================================= */
export const formatPrice = (amount = 0, options = {}) => {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    allowNegative = false,
  } = options;

  const rawAmount = toNumber(amount);
  const safeAmount = allowNegative ? rawAmount : Math.max(0, rawAmount);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(safeAmount);
  } catch {
    const symbol = currency === "INR" ? "₹" : `${currency} `;
    return `${symbol}${Math.round(safeAmount).toLocaleString(DEFAULT_LOCALE)}`;
  }
};

/* =========================================================
   NORMALIZE AMOUNT (FOR STORAGE / CALCULATION)
========================================================= */
export const normalizePrice = (value, options = {}) => {
  const { decimals = 0, allowNegative = false } = options;

  const num = toNumber(value);
  const safeNum = allowNegative ? num : Math.max(0, num);
  const factor = 10 ** Math.max(0, Number(decimals) || 0);

  return Math.round(safeNum * factor) / factor;
};

/* =========================================================
   OPTIONAL: FORMAT WITHOUT SYMBOL
========================================================= */
export const formatNumber = (value = 0, locale = DEFAULT_LOCALE, options = {}) => {
  const num = toNumber(value);

  try {
    return new Intl.NumberFormat(locale, options).format(num);
  } catch {
    return String(num);
  }
};

/* =========================================================
   OPTIONAL: DISCOUNT CALCULATOR
========================================================= */
export const calculateDiscount = (price, originalPrice) => {
  const p = toNumber(price);
  const op = toNumber(originalPrice);

  if (p < 0 || op <= 0 || op <= p) return 0;

  return Math.round(((op - p) / op) * 100);
};

/* =========================================================
   OPTIONAL: SAFE ADD (FLOAT BUG FIX)
========================================================= */
export const safeAdd = (...numbers) => {
  return numbers.reduce((acc, num) => acc + toNumber(num), 0);
};

/* =========================================================
   OPTIONAL: SAFE SUBTRACT
========================================================= */
export const safeSubtract = (a = 0, b = 0) => {
  return toNumber(a) - toNumber(b);
};

/* =========================================================
   OPTIONAL: SAFE MULTIPLY
========================================================= */
export const safeMultiply = (...numbers) => {
  if (!numbers.length) return 0;

  return numbers.reduce((acc, num) => acc * toNumber(num, 1), 1);
};

/* =========================================================
   OPTIONAL: CLAMP PRICE
========================================================= */
export const clampPrice = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = toNumber(value);
  return Math.min(Math.max(num, min), max);
};
