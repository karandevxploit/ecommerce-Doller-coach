const mongoose = require("mongoose");

/**
 * ENTERPRISE ADDRESS SCHEMA
 */

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
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
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
addressSchema.index({ userId: 1, createdAt: -1 });
// addressSchema.index({ userId: 1, isDefault: 1 }); // Duplicated by unique partial index below
addressSchema.index({ location: "2dsphere" });
addressSchema.index({ phone: 1 });
addressSchema.index({ city: 1 });
addressSchema.index({ pincode: 1 });
addressSchema.index({ isDeleted: 1 });

/**
 * UNIQUE DEFAULT ADDRESS PER USER
 */
addressSchema.index(
  { userId: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true, isDeleted: false },
  }
);

/**
 * PRE-SAVE HOOK
 */
addressSchema.pre("save", async function (next) {
  try {
    if (this.phone) {
      this.phone = this.phone.replace(/[^0-9+]/g, "");
    }
    if (this.location?.coordinates?.length === 2) {
      const [lng, lat] = this.location.coordinates;
      if (typeof lng !== "number" || typeof lat !== "number") {
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
    await this.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } },
      { session }
    );
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