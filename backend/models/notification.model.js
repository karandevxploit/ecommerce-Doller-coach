const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ["order", "payment", "offer", "system", "product"], default: "system" },
    audience: {
      type: String,
      enum: ["private", "all", "admin"],
      default: "private",
      index: true,
    },
    // When null, notification is treated as unread by the frontend.
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

