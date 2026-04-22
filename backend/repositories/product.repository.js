const BaseRepository = require("./base.repository");
const Product = require("../models/product.model");
const { logger } = require("../utils/logger");
const { getRequestId } = require("../middlewares/requestTracker");

/**
 * ENTERPRISE PRODUCT REPOSITORY
 *
 * Features:
 * - Soft delete aware
 * - Active product filtering
 * - Safe search
 * - Optimized projections
 * - Read scaling
 * - Logging
 */

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  /**
   * FEATURED PRODUCTS (CACHED-LIKE OPTIMIZED QUERY)
   */
  async findFeatured(limit = 4) {
    const requestId = getRequestId?.();

    try {
      return await this.model
        .find({
          featured: true,
          isDeleted: false,
          status: "active",
        })
        .limit(Math.min(limit, 20)) // safety cap
        .sort({ createdAt: -1 })
        .select("name slug price primaryImage category")
        .lean()
        .read("secondaryPreferred");
    } catch (err) {
      logger.error("PRODUCT_FEATURED_FETCH_FAILED", {
        requestId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * SAFE FULL-TEXT SEARCH
   */
  async searchProducts(query, options = {}) {
    const requestId = getRequestId?.();

    try {
      if (!query || typeof query !== "string") {
        return { docs: [], totalDocs: 0 };
      }

      // Basic sanitization (prevent heavy malformed queries)
      const sanitizedQuery = query
        .trim()
        .replace(/[^\w\s]/gi, "")
        .slice(0, 100);

      if (!sanitizedQuery) {
        return { docs: [], totalDocs: 0 };
      }

      const filter = {
        $text: { $search: sanitizedQuery },
        isDeleted: false,
        status: "active",
      };

      const {
        limit = 20,
        page = 1,
        sort = { score: { $meta: "textScore" } },
      } = options;

      return await this.model.paginate(filter, {
        limit: Math.min(limit, 50), // cap
        page,
        sort,
        select: {
          name: 1,
          slug: 1,
          price: 1,
          primaryImage: 1,
          score: { $meta: "textScore" },
        },
        lean: true,
      });
    } catch (err) {
      logger.error("PRODUCT_SEARCH_FAILED", {
        requestId,
        query,
        error: err.message,
      });
      throw err;
    }
  }
}

module.exports = new ProductRepository();