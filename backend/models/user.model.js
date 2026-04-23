const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const mongoosePaginate = require("mongoose-paginate-v2");

/**
 * ENTERPRISE USER SYSTEM
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
    },
    emailLower: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    phoneNormalized: {
      type: String,
      unique: true,
      sparse: true,
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
    },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    googleId: { type: String, unique: true, sparse: true },
    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    devices: [
      {
        fcmToken: String,
        deviceId: String,
        lastUsed: { type: Date, default: Date.now },
      },
    ],
    avatar: { type: String, default: "" },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    lastLoginIP: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isDeleted: 1 });

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
    if (this.email) {
      this.emailLower = this.email.toLowerCase();
    }
    if (this.phone) {
      this.phoneNormalized = this.phone.replace(/[^0-9+]/g, "");
    }
    if (this.role) {
      this.role = String(this.role).toLowerCase();
    }
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