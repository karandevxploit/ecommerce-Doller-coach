const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

const Config = createMysqlDocumentModel("Config", {
  statics: {
    getSingleton() {
      return this.findOneAndUpdate({ singleton: "CONFIG" }, { $setOnInsert: { singleton: "CONFIG" } }, { upsert: true, new: true });
    },
    updateConfig(updates) {
      return this.findOneAndUpdate({ singleton: "CONFIG" }, { $set: updates, $setOnInsert: { singleton: "CONFIG" } }, { upsert: true, new: true });
    },
    clearCache() {},
  },
});

module.exports = Config;
