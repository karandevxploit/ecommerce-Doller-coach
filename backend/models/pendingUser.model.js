const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    // TTL index: MongoDB will automatically delete the document when expiresAt time is reached
    expiresAt: { type: Date, required: true, index: { expires: "0" } },
  },
  { timestamps: true }
);

module.exports = mongoose.models.PendingUser || mongoose.model("PendingUser", pendingUserSchema);
