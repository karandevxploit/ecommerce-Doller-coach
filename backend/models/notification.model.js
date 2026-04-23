const mongoose = require("mongoose");

/**
 * ENTERPRISE NOTIFICATION SYSTEM
 */

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["order", "payment", "offer", "system", "product"],
      default: "system",
    },
    audience: {
      type: String,
      enum: ["private", "all", "admin"],
      default: "private",
    },
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

/**
 * CONSOLIDATED INDEXES
 */
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ "readBy.userId": 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ isDeleted: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * STATIC METHODS
 */
notificationSchema.statics.markAsRead = async function (
  notificationId,
  userId
) {
  return this.updateOne(
    { _id: notificationId, "readBy.userId": { $ne: userId } },
    { $push: { readBy: { userId, readAt: new Date() } } }
  );
};

notificationSchema.statics.getUserNotifications = function (
  userId,
  limit = 20,
  cursor = null
) {
  const query = {
    isDeleted: false,
    $or: [{ userId: userId }, { audience: "all" }],
  };
  if (cursor) query.createdAt = { $lt: new Date(cursor) };
  return this.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);