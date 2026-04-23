const Product = require("../models/product.model");
const Offer = require("../models/offer.model");
const cache = require("./cache.service");
const { logger } = require("../utils/logger");

let prewarmDone = false;

/**
 * CACHE PRE-WARMING SERVICE (Strict Minimal: Goal 5)
 */
const prewarmCache = async () => {
    if (prewarmDone) return;
    prewarmDone = true;

    try {
        const startTime = Date.now();
        const TIMEOUT_MS = 2000;

        const prewarmTask = (async () => {
            // 1. Landing Page (Top 8 only - Ultra light)
            const productsKey = `products:${JSON.stringify({ page: "1", limit: "20" })}`;
            await cache.getOrSet(productsKey, async () => {
                return await Product.find({ isDeleted: { $ne: true }, status: 'active' })
                    .select("name price images stock category")
                    .sort({ createdAt: -1 })
                    .limit(8)
                    .lean();
            }, 60);

            // 2. Active Offers (Top 3)
            await cache.getOrSet("offers:active", async () => {
                return await Offer.find({ isActive: true, endDate: { $gte: new Date() } })
                    .select("title image discountValue couponCode")
                    .sort({ priority: -1 })
                    .limit(3)
                    .lean();
            }, 60);
        })();

        await Promise.race([
            prewarmTask,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Prewarm Timeout")), TIMEOUT_MS))
        ]);

        logger.info(`✅ [PREWARM_DONE] Optimized in ${Date.now() - startTime}ms.`);
    } catch (err) {
        logger.warn(`⚠️ [PREWARM_BYPASSED] ${err.message}`);
    }
};

module.exports = { prewarmCache };
