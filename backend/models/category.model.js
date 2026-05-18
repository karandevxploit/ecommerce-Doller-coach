const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Category", {
  defaults: {
    isActive: true,
  },
});
