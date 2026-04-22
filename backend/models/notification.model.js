const mongoose = require("mongoose");

/**
 * ENTERPRISE NOTIFICATION SYSTEM
 *
 * Features:
 * - Per-user read tracking
 * - Metadata support
 * - TTL cleanup
 * - Index optimization
 * - Soft delete
 * - Priority system
 */

const notificationSchema = new mongoose.Schema(
  {
    /**
     * Target user (null = broadcast)
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
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
      index: true,
    },

    audience: {
      type: String,
      enum: ["private", "all", "admin"],
      default: "private",
      index: true,
    },

    /**
     * Per-user read tracking (CRITICAL FIX)
     */
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

    /**
     * Metadata (for deep linking, extra info)
     */
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /**
     * Priority handling
     */
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
      index: true,
    },

    /**
     * Delivery status (for push systems)
     */
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      index: true,
    },

    /**
     * Soft delete
     */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * TTL (auto cleanup after 30 days)
     */
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

/**
 * INDEXES (CRITICAL FOR SCALE)
 */
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ "readBy.userId": 1 });

/**
 * STATIC: Mark as Read (Atomic Safe)
 */
notificationSchema.statics.markAsRead = async function (
  notificationId,
  userId
) {
  return this.updateOne(
    {
      _id: notificationId,
      "readBy.userId": { $ne: userId },
    },
    {
      $push: {
        readBy: {
          userId,
          readAt: new Date(),
        },
      },
    }
  );
};

/**
 * STATIC: Fetch User Notifications (Optimized)
 */
notificationSchema.statics.getUserNotifications = function (
  userId,
  limit = 20,
  cursor = null
) {
  const query = {
    isDeleted: false,
    $or: [
      { userId: userId },
      { audience: "all" },
    ],
  };

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);