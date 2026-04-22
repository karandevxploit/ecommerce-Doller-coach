const mongoose = require("mongoose");

/**
 * ENTERPRISE ADDRESS SCHEMA
 *
 * Features:
 * - Single default enforcement (DB + logic)
 * - Geo indexing support
 * - Data normalization
 * - Soft delete support
 * - Optimized indexing
 */

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    label: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    addressLine2: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    landmark: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      match: /^[1-9][0-9]{5}$/, // Indian pincode validation
      index: true,
    },

    country: {
      type: String,
      default: "India",
      trim: true,
    },

    // GeoJSON for scalable geo queries
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },

    locationType: {
      type: String,
      enum: ["manual", "gps", "gps_manual"],
      default: "manual",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * INDEXES (Performance + Consistency)
 */
addressSchema.index({ userId: 1, createdAt: -1 });
addressSchema.index({ userId: 1, isDefault: 1 });
addressSchema.index({ location: "2dsphere" });

/**
 * UNIQUE DEFAULT ADDRESS PER USER
 * (Partial index ensures only one default per user)
 */
addressSchema.index(
  { userId: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true, isDeleted: false },
  }
);

/**
 * PRE-SAVE HOOK: Normalize & enforce rules
 */
addressSchema.pre("save", async function (next) {
  try {
    // Normalize phone (remove spaces, dashes)
    if (this.phone) {
      this.phone = this.phone.replace(/[^0-9+]/g, "");
    }

    // Normalize location
    if (this.location?.coordinates?.length === 2) {
      const [lng, lat] = this.location.coordinates;
      if (
        typeof lng !== "number" ||
        typeof lat !== "number"
      ) {
        this.location = undefined;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * STATIC METHOD: Safely set default address
 */
addressSchema.statics.setDefaultAddress = async function (userId, addressId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Unset previous default
    await this.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } },
      { session }
    );

    // Set new default
    await this.updateOne(
      { _id: addressId, userId },
      { $set: { isDefault: true } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports =
  mongoose.models.Address ||
  mongoose.model("Address", addressSchema);