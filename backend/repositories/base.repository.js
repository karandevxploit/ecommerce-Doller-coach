const mongoose = require("mongoose");
const { logger } = require("../utils/logger");
const { getRequestId } = require("../middlewares/requestTracker");

/**
 * ENTERPRISE BASE REPOSITORY
 *
 * Features:
 * - Safe ObjectId handling
 * - Structured logging
 * - Read scaling
 * - Fail-safe DB operations
 * - Cursor pagination support
 * - Soft delete awareness
 */

const MAX_LIMIT = 100;

const toObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id || ""))) return null;
  return String(id);
};

const normalizeLimit = (limit, fallback = 20) => {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), MAX_LIMIT);
};

const normalizePage = (page) => {
  const value = Number(page);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
};

const applyReadOptions = (query, options = {}) => {
  if (options.readPreference && typeof query.read === "function") {
    query.read(options.readPreference);
  }

  if (options.session && typeof query.session === "function") {
    query.session(options.session);
  }

  return query;
};

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  /**
   * Validate ObjectId
   */
  isValidId(id) {
    return Boolean(toObjectId(id));
  }

  /**
   * Cast ObjectId safely
   */
  toObjectId(id) {
    return toObjectId(id);
  }

  /**
   * Soft-delete filter
   */
  withSoftDelete(filter = {}, options = {}) {
    if (options.includeDeleted || Object.prototype.hasOwnProperty.call(filter, "isDeleted")) {
      return { ...filter };
    }

    return { ...filter, isDeleted: false };
  }

  /**
   * findById (Safe)
   */
  async findById(id, select = "", populate = "", options = {}) {
    const requestId = getRequestId?.();

    try {
      const safeId = this.toObjectId(id);
      if (!safeId) return null;

      const query = this.model
        .findOne(this.withSoftDelete({ _id: safeId }, options), select)
        .populate(populate)
        .lean(options.leanOptions || true);

      return await applyReadOptions(query, options);
    } catch (err) {
      logger.error("REPO_FIND_BY_ID_FAILED", {
        requestId,
        model: this.model.modelName,
        id,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * findOne (Safe)
   */
  async findOne(filter = {}, select = "", populate = "", options = {}) {
    const requestId = getRequestId?.();

    try {
      const query = this.model
        .findOne(this.withSoftDelete(filter, options))
        .select(select)
        .populate(populate)
        .lean(options.leanOptions || true);

      return await applyReadOptions(query, options);
    } catch (err) {
      logger.error("REPO_FIND_ONE_FAILED", {
        requestId,
        model: this.model.modelName,
        filter,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * find (Optimized)
   */
  async find(filter = {}, options = {}) {
    const requestId = getRequestId?.();

    const {
      sort = { createdAt: -1 },
      limit = 20,
      page = 1,
      select = "",
      populate = "",
      cursor = null,
      includeDeleted = false,
    } = options;

    try {
      const query = this.withSoftDelete(filter, { includeDeleted });
      const safeLimit = normalizeLimit(limit);
      const safePage = normalizePage(page);

      // Cursor-based pagination (better than skip)
      if (cursor) {
        const safeCursor = this.toObjectId(cursor);
        if (safeCursor) query._id = { $lt: safeCursor };
      }

      if (this.model.paginate) {
        return await this.model.paginate(query, {
          sort,
          limit: safeLimit,
          page: safePage,
          select,
          populate,
          lean: true,
          session: options.session,
        });
      }

      const request = this.model
        .find(query)
        .sort(sort)
        .limit(safeLimit)
        .select(select)
        .populate(populate)
        .lean(options.leanOptions || true);

      return await applyReadOptions(request, options);
    } catch (err) {
      logger.error("REPO_FIND_FAILED", {
        requestId,
        model: this.model.modelName,
        filter,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * create
   */
  async create(data, options = {}) {
    const requestId = getRequestId?.();

    try {
      if (Array.isArray(data)) {
        return await this.model.create(data, options);
      }

      const doc = new this.model(data);
      return await doc.save(options);
    } catch (err) {
      logger.error("REPO_CREATE_FAILED", {
        requestId,
        model: this.model.modelName,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * updateById (Safe + Validators)
   */
  async updateById(id, data, options = {}) {
    const requestId = getRequestId?.();

    try {
      const safeId = this.toObjectId(id);
      if (!safeId) return null;

      return await this.model.findOneAndUpdate(
        this.withSoftDelete({ _id: safeId }, options),
        data,
        {
          new: true,
          runValidators: true,
          context: "query",
          ...options,
        }
      ).lean();
    } catch (err) {
      logger.error("REPO_UPDATE_FAILED", {
        requestId,
        model: this.model.modelName,
        id,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * soft delete (default)
   */
  async deleteById(id, options = {}) {
    const requestId = getRequestId?.();

    try {
      const safeId = this.toObjectId(id);
      if (!safeId) return null;

      return await this.model.findOneAndUpdate(
        this.withSoftDelete({ _id: safeId }, options),
        { isDeleted: true },
        { new: true, runValidators: true, context: "query" }
      ).lean();
    } catch (err) {
      logger.error("REPO_DELETE_FAILED", {
        requestId,
        model: this.model.modelName,
        id,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * HARD DELETE (explicit)
   */
  async hardDeleteById(id) {
    const requestId = getRequestId?.();

    try {
      const safeId = this.toObjectId(id);
      if (!safeId) return null;

      return await this.model.findByIdAndDelete(safeId).lean();
    } catch (err) {
      logger.error("REPO_HARD_DELETE_FAILED", {
        requestId,
        model: this.model.modelName,
        id,
        error: err.message,
      });
      throw err;
    }
  }
}

module.exports = BaseRepository;
