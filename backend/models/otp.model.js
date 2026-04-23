const mongoose = require("mongoose");

/**
 * ENTERPRISE OTP SYSTEM
 */

const MAX_ATTEMPTS = 5;

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "phone", "password_reset", "signup", "login"],
      required: true,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
otpSchema.index({ userId: 1, channel: 1, usedAt: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto delete
otpSchema.index({ usedAt: 1 });
otpSchema.index(
  { userId: 1, channel: 1 },
  {
    unique: true,
    partialFilterExpression: { usedAt: null },
  }
);

/**
 * PRE-VALIDATE: Ensure valid target
 */
otpSchema.pre("validate", function (next) {
  try {
    if (!this.email && !this.phone) {
      return next(new Error("OTP must have email or phone"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC METHODS
 */
otpSchema.statics.createOtp = async function (data) {
  const { userId, channel } = data;
  await this.deleteMany({ userId, channel, usedAt: null });
  return this.create(data);
};

otpSchema.statics.verifyOtp = async function ({
  userId,
  channel,
  codeHash,
}) {
  const now = new Date();
  const otp = await this.findOne({
    userId,
    channel,
    usedAt: null,
    expiresAt: { $gt: now },
  });

  if (!otp) throw new Error("OTP expired or invalid");
  if (otp.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts");

  await this.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } });
  if (otp.codeHash !== codeHash) throw new Error("Invalid OTP");

  const updated = await this.findOneAndUpdate(
    { _id: otp._id, usedAt: null },
    { $set: { usedAt: new Date() } },
    { new: true }
  );

  if (!updated) throw new Error("OTP already used");
  return true;
};

module.exports =
  mongoose.models.Otp ||
  mongoose.model("Otp", otpSchema);