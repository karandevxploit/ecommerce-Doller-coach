const mongoose = require("mongoose");

/**
 * ENTERPRISE PENDING USER SYSTEM
 */

const MAX_ATTEMPTS = 5;

const pendingUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
pendingUserSchema.index({ email: 1 }, { unique: true }); 
pendingUserSchema.index({ email: 1, expiresAt: 1 });
pendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * STATIC METHODS
 */
pendingUserSchema.statics.createPendingUser = async function (data) {
  const { email } = data;
  await this.deleteOne({ email });
  return this.create(data);
};

pendingUserSchema.statics.verifyOtp = async function ({
  email,
  otpHash,
}) {
  const now = new Date();
  const user = await this.findOne({ email, expiresAt: { $gt: now } });

  if (!user) throw new Error("OTP expired or invalid");
  if (user.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts");

  await this.updateOne({ _id: user._id }, { $inc: { attempts: 1 } });
  if (user.otpHash !== otpHash) throw new Error("Invalid OTP");

  await this.deleteOne({ _id: user._id });
  return { name: user.name, email: user.email, passwordHash: user.passwordHash };
};

module.exports =
  mongoose.models.PendingUser ||
  mongoose.model("PendingUser", pendingUserSchema);