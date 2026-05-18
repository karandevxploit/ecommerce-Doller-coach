const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Notification", {
  statics: {
    markAsRead(notificationId, userId) {
      return this.updateOne({ _id: notificationId, "readBy.userId": { $ne: userId } }, { $push: { readBy: { userId, readAt: new Date().toISOString() } } });
    },
    getUserNotifications(userId, options = {}) {
      return this.find({ $or: [{ userId }, { audience: "all" }], audience: { $ne: "admin" } })
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 20);
    },
    async countUnreadForUser(userId) {
      return this.countDocuments({ audience: { $ne: "admin" }, $or: [{ userId }, { audience: "all" }], "readBy.userId": { $ne: userId } });
    },
  },
});
