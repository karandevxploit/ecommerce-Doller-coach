const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    label: { type: String, default: "Home" }, // Home, Work, etc.

    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" },

    // GPS coordinates from browser/map marker
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    locationType: {
      type: String,
      enum: ["manual", "gps", "gps_manual"],
      default: "manual",
    },

    isDefault: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Address || mongoose.model("Address", addressSchema);

