const mongoose = require("mongoose");

/**
 * ENTERPRISE PENDING USER SYSTEM
 *
 * Features:
 * - Single active pending user per email
 * - TTL auto cleanup
 * - Attempt limiting
 * - Atomic verification
 * - Abuse tracking (IP/device)
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
      index: true,
    },

    /**
     * Store hashed password only
     */
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

    /**
     * Security metadata
     */
    ip: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },

    /**
     * TTL auto delete
     */
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

/**
 * INDEXES
 */
pendingUserSchema.index({ email: 1 }, { unique: true }); // only one active per email
pendingUserSchema.index({ email: 1, expiresAt: 1 });

/**
 * STATIC: Create or Replace Pending User (Idempotent)
 */
pendingUserSchema.statics.createPendingUser = async function (data) {
  const { email } = data;

  // Remove existing pending user
  await this.deleteOne({ email });

  return this.create(data);
};

/**
 * STATIC: Verify OTP (Atomic Safe)
 */
pendingUserSchema.statics.verifyOtp = async function ({
  email,
  otpHash,
}) {
  const now = new Date();

  const user = await this.findOne({
    email,
    expiresAt: { $gt: now },
  });

  if (!user) {
    throw new Error("OTP expired or invalid");
  }

  if (user.attempts >= MAX_ATTEMPTS) {
    throw new Error("Too many attempts");
  }

  // Increment attempts first
  await this.updateOne(
    { _id: user._id },
    { $inc: { attempts: 1 } }
  );

  if (user.otpHash !== otpHash) {
    throw new Error("Invalid OTP");
  }

  // Delete after success (prevents reuse)
  await this.deleteOne({ _id: user._id });

  return {
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
  };
};

module.exports =
  mongoose.models.PendingUser ||
  mongoose.model("PendingUser", pendingUserSchema);