const { ok, fail } = require("../utils/apiResponse");
const { safeCall } = require("../config/redis");
const { logger } = require("../utils/logger");

const CACHE_TTL = 3600; // 1 hour

// ===============================
// PINCODE VALIDATION
// ===============================
const isValidPincode = (pincode) => /^[1-9][0-9]{5}$/.test(pincode);

// ===============================
// CORE ETA LOGIC
// ===============================
const calculateETA = (pincode) => {
    const firstDigit = pincode[0];

    let estimatedDays = 5;
    let zone = "standard";

    // Tier mapping (India logistics style)
    if (firstDigit === "1") {
        estimatedDays = 2;
        zone = "metro_north";
    } else if (firstDigit === "4") {
        estimatedDays = 3;
        zone = "metro_west";
    } else if (["5", "6"].includes(firstDigit)) {
        estimatedDays = 4;
        zone = "south_zone";
    } else if (["7", "8"].includes(firstDigit)) {
        estimatedDays = 6;
        zone = "remote_east";
    }

    return { estimatedDays, zone };
};

// ===============================
// DELIVERY ETA API
// ===============================
exports.checkETA = async (req, res) => {
    try {
        const { pincode } = req.params;

        // 1. VALIDATION
        if (!isValidPincode(pincode)) {
            return fail(res, "Invalid pincode format", 400);
        }

        const cacheKey = `eta:${pincode}`;

        // 2. CACHE CHECK (SAFE)
        const cached = await safeCall((r) => r.get(cacheKey));
        if (cached) {
            return ok(res, JSON.parse(cached), "ETA (cache)");
        }

        // 3. LOGIC
        const { estimatedDays, zone } = calculateETA(pincode);

        // 4. SERVICEABILITY (Example Rule)
        const isServiceable = !["8", "9"].includes(pincode[0]); // remote zones example

        if (!isServiceable) {
            const response = {
                pincode,
                isServiceable: false,
                message: "Delivery not available in this region",
            };

            return ok(res, response);
        }

        // 5. DELIVERY DATE (IST SAFE)
        const now = new Date();
        const deliveryDate = new Date(
            now.getTime() + estimatedDays * 24 * 60 * 60 * 1000
        );

        const response = {
            pincode,
            estimatedDays,
            zone,
            message: "Delivery timeline calculated",
            formattedDate: deliveryDate.toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
            }),
            isServiceable: true,
        };

        // 6. CACHE SET (NON-BLOCKING)
        safeCall((r) =>
            r.set(cacheKey, JSON.stringify(response), "EX", CACHE_TTL)
        );

        return ok(res, response, "ETA generated");
    } catch (err) {
        logger.error("[ETA_ERROR]", { message: err.message });

        // FAIL SAFE (never break UX)
        return ok(res, {
            estimatedDays: 5,
            message: "Standard delivery",
            isServiceable: true,
        });
    }
};