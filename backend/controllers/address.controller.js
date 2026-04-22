const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const addressRepository = require("../repositories/address.repository");
const User = require("../models/user.model");
const { ok, fail } = require("../utils/apiResponse");
const { addressSchema } = require("../validations/address.validation");

function buildFormattedAddress(data) {
  return [
    data.name && `<b>${data.name}</b>`,
    data.phone && `(${data.phone})`,
    data.addressLine1,
    data.addressLine2,
    data.city,
    data.state,
    data.pincode,
    data.country,
  ]
    .filter(Boolean)
    .join(", ");
}

// ===============================
// CREATE ADDRESS (TRANSACTION SAFE)
// ===============================
exports.createAddress = asyncHandler(async (req, res) => {
  const payload = addressSchema.parse(req.body);
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (payload.isDefault) {
      await addressRepository.unsetDefaults(userId, session);
    }

    const addr = await addressRepository.create(
      { ...payload, userId },
      session
    );

    const update = { $addToSet: { addresses: addr._id } };

    if (addr.isDefault) {
      update.$set = {
        defaultAddressId: addr._id,
        address: buildFormattedAddress(addr),
        location: {
          lat: addr.latitude || null,
          lng: addr.longitude || null,
        },
      };
    }

    await User.updateOne({ _id: userId }, update, { session });

    await session.commitTransaction();
    session.endSession();

    return ok(res, addr, "Address created", 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ===============================
// UPDATE ADDRESS (SAFE)
// ===============================
exports.updateAddress = asyncHandler(async (req, res) => {
  const payload = addressSchema.parse(req.body);
  const { id } = req.params;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existing = await addressRepository.findByUserIdAndId(userId, id);
    if (!existing) {
      await session.abortTransaction();
      return fail(res, "Not found", 404);
    }

    if (payload.isDefault) {
      await addressRepository.unsetDefaults(userId, session);
    }

    const updated = await addressRepository.updateById(id, payload, session);

    if (updated.isDefault) {
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            defaultAddressId: id,
            address: buildFormattedAddress(updated),
            location: {
              lat: updated.latitude || null,
              lng: updated.longitude || null,
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return ok(res, updated);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ===============================
// DELETE ADDRESS (SAFE)
// ===============================
exports.deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const address = await addressRepository.findByUserIdAndId(userId, id);
    if (!address) {
      await session.abortTransaction();
      return fail(res, "Not found", 404);
    }

    await addressRepository.deleteById(id, session);

    const update = {
      $pull: { addresses: id },
    };

    // Assign new default if needed
    if (address.isDefault) {
      const next = await addressRepository.findOne(userId, session);

      update.$set = {
        defaultAddressId: next ? next._id : null,
      };
    }

    await User.updateOne({ _id: userId }, update, { session });

    await session.commitTransaction();
    session.endSession();

    return ok(res, { deleted: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// ===============================
// SET DEFAULT (RACE SAFE)
// ===============================
exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const address = await addressRepository.findByUserIdAndId(userId, id);
    if (!address) {
      await session.abortTransaction();
      return fail(res, "Not found", 404);
    }

    await addressRepository.unsetDefaults(userId, session);
    await addressRepository.updateById(id, { isDefault: true }, session);

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          defaultAddressId: id,
          address: buildFormattedAddress(address),
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return ok(res, { ok: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});