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

const PRODUCT_SELECT =
  "name title slug price originalPrice images primaryImage hoverImage variants category colors sizes gender stock status offer rating ratings salesCount video createdAt";
const MAX_FEATURED_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

const clean = (value = "") => String(value || "").trim();
const normalizeLimit = (value, fallback = 20, max = MAX_SEARCH_LIMIT) => {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), max);
};
const normalizePage = (value) => {
  const page = Number(value);
  if (!Number.isFinite(page) || page <= 0) return 1;
  return Math.floor(page);
};
const emptyPage = (page = 1, limit = 20) => ({
  docs: [],
  products: [],
  totalDocs: 0,
  total: 0,
  limit,
  page,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
});
const sanitizeSearch = (query = "") =>
  clean(query)
    .replace(/[^\w\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);

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
      const safeLimit = normalizeLimit(limit, 4, MAX_FEATURED_LIMIT);

      return await this.model
        .find({
          featured: true,
          isDeleted: false,
          status: "active",
        })
        .limit(safeLimit)
        .sort({ createdAt: -1 })
        .select(PRODUCT_SELECT)
        .populate("category", "name slug")
        .read("secondaryPreferred")
        .lean();
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
    const limit = normalizeLimit(options.limit, 20, MAX_SEARCH_LIMIT);
    const page = normalizePage(options.page);

    try {
      if (!query || typeof query !== "string") {
        return emptyPage(page, limit);
      }

      const sanitizedQuery = sanitizeSearch(query);

      if (!sanitizedQuery) {
        return emptyPage(page, limit);
      }

      const filter = {
        $text: { $search: sanitizedQuery },
        isDeleted: false,
        status: "active",
      };

      const {
        sort = { score: { $meta: "textScore" } },
        category,
        gender,
      } = options;

      if (category && this.isValidId(category)) {
        filter.category = this.toObjectId(category);
      }

      if (gender && !["all", "collection"].includes(clean(gender).toLowerCase())) {
        filter.gender = clean(gender).toLowerCase();
      }

      const projection = {
        name: 1,
        title: 1,
        slug: 1,
        price: 1,
        originalPrice: 1,
        images: 1,
        primaryImage: 1,
        hoverImage: 1,
        variants: 1,
        category: 1,
        colors: 1,
        sizes: 1,
        gender: 1,
        stock: 1,
        status: 1,
        offer: 1,
        rating: 1,
        ratings: 1,
        score: { $meta: "textScore" },
      };

      const result = await this.model.paginate(filter, {
        limit,
        page,
        sort,
        select: projection,
        populate: { path: "category", select: "name slug" },
        lean: true,
      });

      return {
        ...result,
        products: result.docs,
        total: result.totalDocs,
      };
    } catch (err) {
      if (err?.code === 27 || /text index/i.test(err.message || "")) {
        logger.warn("PRODUCT_SEARCH_TEXT_INDEX_MISSING", {
          requestId,
          query,
        });
        return emptyPage(page, limit);
      }

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
