const mongoose = require("mongoose");
const Address = require("../models/address.model");
const User = require("../models/user.model");
const { safeHandler } = require("../middlewares/error.middleware");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const normalizePhone = (value = "") => String(value).replace(/\D/g, "").slice(-10);
const normalizePincode = (value = "") => String(value).replace(/\D/g, "").slice(0, 6);
const clean = (value = "") => String(value || "").trim();

const getUserId = (req) => req.user?._id || req.user?.id;

const serializeAddress = (address) => {
  if (!address) return null;

  const obj = typeof address.toObject === "function" ? address.toObject() : address;

  return {
    ...obj,
    id: String(obj._id || obj.id),
    _id: obj._id,
    name: obj.fullName || obj.name || "",
    fullName: obj.fullName || obj.name || "",
    phone: obj.phone || "",
    address: obj.addressLine1 || obj.address || "",
    addressLine1: obj.addressLine1 || obj.address || "",
    city: obj.city || "",
    state: obj.state || "",
    pincode: obj.pincode || "",
    country: obj.country || "India",
    type: obj.type || "Home",
    isDefault: Boolean(obj.isDefault),
  };
};

const parseAddressPayload = (body = {}) => {
  const fullName = clean(body.fullName || body.name);
  const phone = normalizePhone(body.phone);
  const addressLine1 = clean(body.addressLine1 || body.address || body.street);
  const city = clean(body.city);
  const state = clean(body.state);
  const pincode = normalizePincode(body.pincode || body.zip || body.postalCode);
  const country = clean(body.country) || "India";
  const type = ["Home", "Work", "Other"].includes(body.type) ? body.type : "Home";

  const errors = [];
  if (fullName.length < 2) errors.push("Full name is required");
  if (!/^\d{10}$/.test(phone)) errors.push("Valid 10-digit phone number is required");
  if (addressLine1.length < 5) errors.push("Address is too short");
  if (!city) errors.push("City is required");
  if (!state) errors.push("State is required");
  if (!/^\d{6}$/.test(pincode)) errors.push("Valid 6-digit pincode is required");

  if (errors.length) {
    const err = new Error(errors[0]);
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }

  return {
    fullName,
    phone,
    addressLine1,
    city,
    state,
    pincode,
    country,
    type,
    isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : false,
  };
};

const syncUserAddressRefs = async (userId) => {
  if (!userId) return;

  const addresses = await Address.find({ user: userId }).select("_id isDefault").lean();
  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0] || null;

  await User.findByIdAndUpdate(userId, {
    addresses: addresses.map((address) => address._id),
    defaultAddressId: defaultAddress?._id || null,
  });
};

const makeOnlyDefault = async (userId, addressId) => {
  await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { $set: { isDefault: false } });
  await Address.findOneAndUpdate({ user: userId, _id: addressId }, { $set: { isDefault: true } });
  await syncUserAddressRefs(userId);
};

const listAddressesHandler = async (req, res) => {
  const userId = getUserId(req);
  const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, updatedAt: -1 }).lean();
  const mapped = addresses.map(serializeAddress);

  return res.json({
    success: true,
    data: {
      addresses: mapped,
      items: mapped,
    },
    message: "",
  });
};

const createAddressHandler = async (req, res) => {
  const userId = getUserId(req);
  const payload = parseAddressPayload(req.body);
  const count = await Address.countDocuments({ user: userId });

  const address = await Address.create({
    ...payload,
    user: userId,
    isDefault: payload.isDefault || count === 0,
  });

  if (address.isDefault || count === 0) {
    await makeOnlyDefault(userId, address._id);
  } else {
    await syncUserAddressRefs(userId);
  }

  return res.status(201).json({
    success: true,
    data: { address: serializeAddress(address) },
    message: "Address added",
  });
};

const updateAddressHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, data: null, message: "Invalid address ID" });
  }

  const payload = parseAddressPayload(req.body);
  const address = await Address.findOneAndUpdate(
    { _id: id, user: userId },
    { ...payload, user: userId },
    { new: true, runValidators: true }
  );

  if (!address) {
    return res.status(404).json({ success: false, data: null, message: "Address not found" });
  }

  if (address.isDefault) {
    await makeOnlyDefault(userId, address._id);
  } else {
    await syncUserAddressRefs(userId);
  }

  return res.json({
    success: true,
    data: { address: serializeAddress(address) },
    message: "Address updated",
  });
};

const deleteAddressHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, data: null, message: "Invalid address ID" });
  }

  const deleted = await Address.findOneAndDelete({ _id: id, user: userId });

  if (!deleted) {
    return res.status(404).json({ success: false, data: null, message: "Address not found" });
  }

  if (deleted.isDefault) {
    const nextDefault = await Address.findOne({ user: userId }).sort({ updatedAt: -1 });
    if (nextDefault) {
      nextDefault.isDefault = true;
      await nextDefault.save();
    }
  }

  await syncUserAddressRefs(userId);

  return res.json({ success: true, data: null, message: "Address deleted" });
};

const setDefaultAddressHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, data: null, message: "Invalid address ID" });
  }

  const address = await Address.findOne({ _id: id, user: userId });
  if (!address) {
    return res.status(404).json({ success: false, data: null, message: "Address not found" });
  }

  await makeOnlyDefault(userId, address._id);

  return res.json({
    success: true,
    data: { address: serializeAddress({ ...address.toObject(), isDefault: true }) },
    message: "Default address updated",
  });
};

const getAddressHandler = async (req, res) => {
  const userId = getUserId(req);
  const address = await Address.findOne({ user: userId }).sort({ isDefault: -1, updatedAt: -1 });
  return res.json({ success: true, data: serializeAddress(address) || {}, message: "" });
};

const saveAddressHandler = async (req, res) => {
  const userId = getUserId(req);
  const payload = parseAddressPayload({ ...req.body, isDefault: true });

  const existing = await Address.findOne({ user: userId }).sort({ isDefault: -1, updatedAt: -1 });
  const address = existing
    ? await Address.findOneAndUpdate(
        { _id: existing._id, user: userId },
        { ...payload, user: userId, isDefault: true },
        { new: true, runValidators: true }
      )
    : await Address.create({ ...payload, user: userId, isDefault: true });

  await makeOnlyDefault(userId, address._id);

  return res.json({
    success: true,
    data: serializeAddress(address),
    message: "Address saved",
  });
};

exports.getAddress = safeHandler(getAddressHandler);
exports.saveAddress = safeHandler(saveAddressHandler);
exports.deleteAddress = safeHandler(deleteAddressHandler);

exports.listAddresses = safeHandler(listAddressesHandler);
exports.createAddress = safeHandler(createAddressHandler);
exports.updateAddress = safeHandler(updateAddressHandler);
exports.setDefaultAddress = safeHandler(setDefaultAddressHandler);
