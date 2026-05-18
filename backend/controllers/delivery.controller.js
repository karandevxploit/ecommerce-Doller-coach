const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_TTL = 3600;
const PINCODE_RE = /^[1-8][0-9]{5}$/;

const cleanPincode = (value = "") => String(value ?? "").replace(/\D/g, "").slice(0, 6);
const isValidPincode = (pincode) => PINCODE_RE.test(pincode);

const ZONE_MAP = {
  1: { zone: "north", estimatedDays: 2 },
  2: { zone: "north_central", estimatedDays: 3 },
  3: { zone: "west", estimatedDays: 4 },
  4: { zone: "west_metro", estimatedDays: 3 },
  5: { zone: "south_central", estimatedDays: 4 },
  6: { zone: "south", estimatedDays: 4 },
  7: { zone: "east", estimatedDays: 5 },
  8: { zone: "east_central", estimatedDays: 6 },
};

const calculateETA = (pincode) => {
  const firstDigit = Number(pincode[0]);
  return ZONE_MAP[firstDigit] || { zone: "standard", estimatedDays: 5 };
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const formatDate = (date) => date.toLocaleDateString("en-IN", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const buildResponse = (pincode, { estimatedDays, zone }) => {
  const today = new Date();
  const deliveryDate = addDays(today, estimatedDays);
  const minDays = Math.max(1, estimatedDays - 1);
  const maxDays = estimatedDays + 1;

  return {
    pincode,
    isServiceable: true,
    serviceable: true,
    available: true,
    deliveryAvailable: true,
    estimatedDays,
    minDays,
    maxDays,
    etaDays: estimatedDays,
    zone,
    deliveryFee: 40,
    isFreeDelivery: false,
    estimatedDeliveryDate: deliveryDate.toISOString(),
    estimatedDelivery: deliveryDate.toISOString(),
    formattedDate: formatDate(deliveryDate),
    message: `Delivery available in ${minDays}-${maxDays} days`,
  };
};

const parseCached = (cached) => {
  if (!cached) return null;

  try {
    return typeof cached === "string" ? JSON.parse(cached) : cached;
  } catch (err) {
    logger.warn("[ETA_CACHE_PARSE_ERROR]", { message: err.message });
    return null;
  }
};

exports.checkETA = async (req, res) => {
  const pincode = cleanPincode(req.params?.pincode || req.query?.pincode || req.body?.pincode);

  if (!isValidPincode(pincode)) {
    return fail(res, "Invalid pincode format", 400);
  }

  try {
    const cacheKey = `eta:${pincode}`;
    const cached = parseCached(await safeCall((r) => r.get(cacheKey)));
    if (cached) return ok(res, cached, "ETA");

    const response = buildResponse(pincode, calculateETA(pincode));

    safeCall((r) => r.set(cacheKey, JSON.stringify(response), "EX", CACHE_TTL)).catch(() => {});

    return ok(res, response, "ETA generated");
  } catch (err) {
    logger.error("[ETA_ERROR]", { pincode, message: err.message });

    return ok(res, buildResponse(pincode, { estimatedDays: 5, zone: "standard" }), "Standard delivery");
  }
};
