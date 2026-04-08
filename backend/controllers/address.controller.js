const asyncHandler = require("express-async-handler");
const addressRepository = require("../repositories/address.repository");
const User = require("../models/user.model");
const { ok, fail } = require("../utils/apiResponse");

function buildFormattedAddress({ name, phone, addressLine1, addressLine2, city, state, pincode, country }) {
  const parts = [
    name ? `<b>${name}</b>` : "",
    phone ? `(${phone})` : "",
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    country,
  ]
    .map((p) => (p || "").trim())
    .filter(Boolean);

  return parts.join(", ");
}

exports.listAddresses = asyncHandler(async (req, res) => {
  const addresses = await addressRepository.findByUser(req.user._id);
  return ok(res, addresses);
});

exports.createAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const payload = req.body;

  if (!payload.name || !payload.phone || !payload.addressLine1 || !payload.city || !payload.state || !payload.pincode) {
    return fail(res, "Mandatory fields missing: name, phone, addressLine1, city, state, pincode", 400);
  }

  // Handle default address logic
  if (payload.isDefault) {
    await addressRepository.unsetDefaults(userId);
  }

  const addr = await addressRepository.create({
    ...payload,
    userId,
    isDefault: Boolean(payload.isDefault),
  });

  // Maintain User references
  await User.updateOne({ _id: userId }, { $addToSet: { addresses: addr._id } });

  if (addr.isDefault) {
    const formatted = buildFormattedAddress(addr);
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          defaultAddressId: addr._id,
          address: formatted,
          location: { lat: addr.latitude || null, lng: addr.longitude || null },
        },
      }
    );
  }

  return ok(res, addr, "Address created", 201);
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const payload = req.body;

  const address = await addressRepository.findByUserIdAndId(userId, id);
  if (!address) return fail(res, "Address not found", 404);

  if (payload.isDefault) {
    await addressRepository.unsetDefaults(userId);
    await User.updateOne({ _id: userId }, { $set: { defaultAddressId: address._id } });
  }

  const updated = await addressRepository.updateById(id, payload);

  if (updated.isDefault) {
    const formatted = buildFormattedAddress(updated);
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          address: formatted,
          location: { lat: updated.latitude || null, lng: updated.longitude || null },
        },
      }
    );
  }

  return ok(res, updated, "Address updated");
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const address = await addressRepository.findByUserIdAndId(userId, id);
  if (!address) return fail(res, "Address not found", 404);

  await addressRepository.deleteById(id);

  const updateOps = { $pull: { addresses: id } };
  if (address.isDefault) {
    updateOps.$set = { defaultAddressId: null };
  }
  await User.updateOne({ _id: userId }, updateOps);

  return ok(res, { deleted: true }, "Address deleted");
});

exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const address = await addressRepository.findByUserIdAndId(userId, id);
  if (!address) return fail(res, "Address not found", 404);

  await addressRepository.unsetDefaults(userId);
  const updated = await addressRepository.updateById(id, { isDefault: true });

  const formatted = buildFormattedAddress(updated);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        defaultAddressId: id,
        address: formatted,
        location: { lat: updated.latitude || null, lng: updated.longitude || null },
      },
    }
  );

  return ok(res, { ok: true }, "Default address set");
});

