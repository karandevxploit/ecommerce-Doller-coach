const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    channel: {
      type: String,
      enum: ["email", "phone", "password_reset", "signup", "login"],
      required: true,
      index: true,
    },

    email: { type: String, default: null },
    phone: { type: String, default: null },

    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

otpSchema.index({ userId: 1, channel: 1, usedAt: 1, expiresAt: 1 });

module.exports = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
