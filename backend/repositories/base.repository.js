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

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  /**
   * Validate ObjectId
   */
  isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * findById (Safe)
   */
  async findById(id, select = "", populate = "", options = {}) {
    const requestId = getRequestId?.();

    try {
      if (!this.isValidId(id)) return null;

      return await this.model
        .findById(id, select)
        .populate(populate)
        .lean()
        .read("secondaryPreferred");
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
      return await this.model
        .findOne({ ...filter, isDeleted: false })
        .select(select)
        .populate(populate)
        .lean()
        .read("secondaryPreferred");
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
    } = options;

    try {
      const query = { ...filter, isDeleted: false };

      // Cursor-based pagination (better than skip)
      if (cursor) {
        query._id = { $lt: cursor };
      }

      if (this.model.paginate) {
        return await this.model.paginate(query, {
          sort,
          limit,
          page,
          select,
          populate,
          lean: true,
        });
      }

      return await this.model
        .find(query)
        .sort(sort)
        .limit(limit)
        .select(select)
        .populate(populate)
        .lean()
        .read("secondaryPreferred");
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
      return await this.model.create(data);
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
      if (!this.isValidId(id)) return null;

      return await this.model.findByIdAndUpdate(
        id,
        data,
        {
          new: true,
          runValidators: true,
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
  async deleteById(id) {
    const requestId = getRequestId?.();

    try {
      if (!this.isValidId(id)) return null;

      return await this.model.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
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
      if (!this.isValidId(id)) return null;

      return await this.model.findByIdAndDelete(id).lean();
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