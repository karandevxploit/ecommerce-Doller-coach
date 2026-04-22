const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE USER SYSTEM
 *
 * Features:
 * - Strong uniqueness (case-insensitive email)
 * - Account lockout enforcement
 * - Multi-device support
 * - Security metadata
 * - Soft delete
 */

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },

    emailLower: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      index: true,
    },

    phoneNormalized: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["email", "google", "github"],
      default: "email",
      required: true,
    },

    password: {
      type: String,
      select: false,
      required: function () {
        return this.isNew && this.provider === "email";
      },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    /**
     * VERIFICATION
     */
    emailVerified: { type: Boolean, default: false, index: true },
    phoneVerified: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false, index: true },

    /**
     * OAUTH
     */
    googleId: { type: String, unique: true, sparse: true },

    /**
     * ADDRESSES
     */
    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },

    /**
     * DEVICE MANAGEMENT (MULTI-DEVICE)
     */
    devices: [
      {
        fcmToken: String,
        deviceId: String,
        lastUsed: { type: Date, default: Date.now },
      },
    ],

    avatar: { type: String, default: "" },

    /**
     * SECURITY
     */
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    tokenVersion: { type: Number, default: 0 },

    lastLoginAt: { type: Date },
    lastLoginIP: { type: String },

    /**
     * SOFT DELETE
     */
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/**
 * INDEXES
 */
// Explicit indexes removed in favor of field-level definitions as requested

/**
 * PASSWORD COMPARE
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * ACCOUNT LOCK CHECK
 */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

/**
 * PRE-SAVE HOOK
 */
userSchema.pre("save", async function (next) {
  try {
    // Normalize email
    if (this.email) {
      this.emailLower = this.email.toLowerCase();
    }

    // Normalize phone
    if (this.phone) {
      this.phoneNormalized = this.phone.replace(/[^0-9+]/g, "");
    }

    // Normalize role
    if (this.role) {
      this.role = String(this.role).toLowerCase();
    }

    // Hash password
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC: Handle Failed Login
 */
userSchema.statics.handleFailedLogin = async function (user) {
  if (!user) return;

  const updates = { $inc: { loginAttempts: 1 } };

  if (user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne({ _id: user._id }, updates);
};

/**
 * STATIC: Reset Login Attempts
 */
userSchema.statics.resetLoginAttempts = async function (userId) {
  return this.updateOne(
    { _id: userId },
    { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } }
  );
};

userSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);