const mongoose = require("mongoose");

/**
 * ENTERPRISE OTP SYSTEM
 *
 * Features:
 * - Single active OTP per user/channel
 * - TTL auto cleanup
 * - Attempt limiting
 * - Replay protection
 * - Strong indexing
 */

const MAX_ATTEMPTS = 5;

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    channel: {
      type: String,
      enum: ["email", "phone", "password_reset", "signup", "login"],
      required: true,
      index: true,
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
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    usedAt: {
      type: Date,
      default: null,
      index: true,
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
  },
  { timestamps: true }
);

/**
 * INDEXES
 */
otpSchema.index({ userId: 1, channel: 1, usedAt: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto delete

/**
 * UNIQUE ACTIVE OTP (CRITICAL)
 */
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
 * STATIC: Create OTP (Atomic Replace)
 */
otpSchema.statics.createOtp = async function (data) {
  const { userId, channel } = data;

  // Remove previous active OTP
  await this.deleteMany({
    userId,
    channel,
    usedAt: null,
  });

  return this.create(data);
};

/**
 * STATIC: Verify OTP (Atomic Safe)
 */
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

  if (!otp) {
    throw new Error("OTP expired or invalid");
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new Error("Too many attempts");
  }

  // Increment attempt first (prevent race)
  await this.updateOne(
    { _id: otp._id },
    { $inc: { attempts: 1 } }
  );

  if (otp.codeHash !== codeHash) {
    throw new Error("Invalid OTP");
  }

  // Mark as used (atomic)
  const updated = await this.findOneAndUpdate(
    {
      _id: otp._id,
      usedAt: null,
    },
    {
      $set: { usedAt: new Date() },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("OTP already used");
  }

  return true;
};

module.exports =
  mongoose.models.Otp ||
  mongoose.model("Otp", otpSchema);