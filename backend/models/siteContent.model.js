const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("SiteContent", {
  statics: {
    getContent() {
      return this.findOneAndUpdate({ singleton: "SITE_CONTENT" }, { $setOnInsert: { singleton: "SITE_CONTENT" } }, { upsert: true, new: true });
    },
    updateContent(updates, userId) {
      return this.findOneAndUpdate(
        { singleton: "SITE_CONTENT" },
        { $set: { ...updates, updatedBy: userId }, $setOnInsert: { singleton: "SITE_CONTENT" } },
        { upsert: true, new: true }
      );
    },
    clearCache() {},
  },
});
