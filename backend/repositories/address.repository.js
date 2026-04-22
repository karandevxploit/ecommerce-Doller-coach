const mongoose = require("mongoose");
const BaseRepository = require("./base.repository");
const Address = require("../models/address.model");
const { logger } = require("../utils/logger");

/**
 * ENTERPRISE ADDRESS REPOSITORY
 *
 * Features:
 * - Transaction-safe default handling
 * - Soft delete aware
 * - Lean + projection optimized
 * - Safe ObjectId handling
 * - Logging + fail-safe
 */

class AddressRepository extends BaseRepository {
  constructor() {
    super(Address);
  }

  /**
   * GET USER ADDRESSES (Optimized)
   */
  async findByUser(userId, options = {}) {
    try {
      const query = {
        userId,
        isDeleted: false,
      };

      return await this.model
        .find(query, options.projection || null)
        .sort({ isDefault: -1, createdAt: -1 })
        .lean()
        .read("secondaryPreferred"); // scale reads
    } catch (err) {
      logger.error("ADDRESS_FETCH_FAILED", {
        userId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * SAFE DEFAULT SWITCH (TRANSACTION)
   */
  async setDefaultAddress(userId, addressId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new Error("Invalid address ID");
      }

      // Unset previous defaults
      await this.model.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } },
        { session }
      );

      // Set new default
      const updated = await this.model.findOneAndUpdate(
        { _id: addressId, userId, isDeleted: false },
        { $set: { isDefault: true } },
        { new: true, session }
      );

      if (!updated) {
        throw new Error("Address not found");
      }

      await session.commitTransaction();
      session.endSession();

      return updated.toObject();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

      logger.error("SET_DEFAULT_ADDRESS_FAILED", {
        userId,
        addressId,
        error: err.message,
      });

      throw err;
    }
  }

  /**
   * FIND SINGLE ADDRESS (SAFE)
   */
  async findByUserIdAndId(userId, id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }

      return await this.model
        .findOne({
          _id: id,
          userId,
          isDeleted: false,
        })
        .lean();
    } catch (err) {
      logger.error("ADDRESS_FETCH_SINGLE_FAILED", {
        userId,
        id,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * SOFT DELETE ADDRESS
   */
  async deleteAddress(userId, addressId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        throw new Error("Invalid address ID");
      }

      return await this.model.updateOne(
        { _id: addressId, userId },
        { $set: { isDeleted: true, isDefault: false } }
      );
    } catch (err) {
      logger.error("ADDRESS_DELETE_FAILED", {
        userId,
        addressId,
        error: err.message,
      });
      throw err;
    }
  }
}

module.exports = new AddressRepository();