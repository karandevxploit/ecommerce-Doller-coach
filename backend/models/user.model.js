const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, default: undefined },
    phone: { type: String, unique: true, sparse: true, trim: true, default: undefined },
    provider: {
      type: String,
      enum: ["email", "google", "github"],
      default: "email",
      required: true
    },
    // Password is required for newly-created accounts that rely on email-based auth.
    password: {
      type: String,
      select: false,
      required: function () {
        return this.isNew && this.provider === "email";
      },
    },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },

    // Firebase sync statuses
    emailVerified: { type: Boolean, default: false, index: true },
    phoneVerified: { type: Boolean, default: false, index: true },
    isVerified: { type: Boolean, default: false, index: true },

    // OAuth/Firebase identifiers
    // IMPORTANT: do NOT default to null with unique+sparse; null counts as a value and breaks inserts.
    googleId: { type: String, default: undefined, unique: true, sparse: true, index: true },

    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null },

    // Optional denormalized fields for single-address usage
    address: { type: String, default: "", trim: true },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    fcmToken: { type: String, default: null },
    
    // Auth Hardening: Account Lockout
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre("save", async function (next) {
  // Normalize role
  if (this.role) this.role = String(this.role).toLowerCase();

  // Hash password if modified
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

const mongoosePaginate = require("mongoose-paginate-v2");
userSchema.plugin(mongoosePaginate);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
