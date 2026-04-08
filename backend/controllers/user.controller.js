const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");

exports.profile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password").lean();
  res.json(user);
});

exports.saveFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  await User.updateOne({ _id: req.user._id }, { $set: { fcmToken: token || null } });
  res.json({ ok: true });
});

