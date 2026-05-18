const mongoose = require("mongoose");
const { makeObjectId } = require("../utils/mysqlDocumentModel");

const noopSession = () => ({
  async withTransaction(fn) {
    return fn();
  },
  async startTransaction() {},
  async commitTransaction() {},
  async abortTransaction() {},
  endSession() {},
});

mongoose.startSession = async () => noopSession();
mongoose.connection.readyState = 1;
mongoose.connection.close = async () => {};
mongoose.connection.db = { admin: () => ({ ping: async () => true }) };
mongoose.connection.collections = {
  mysql_documents: {
    async deleteMany() {
      const { getPool } = require("./mysql");
      await getPool().query("DELETE FROM mysql_documents");
      return { deletedCount: 0 };
    },
  },
};

if (!mongoose.Types.ObjectId.isValid) {
  mongoose.Types.ObjectId.isValid = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ""));
}

mongoose.Types.ObjectId.createFromHexString = (value) => String(value || makeObjectId());

module.exports = mongoose;
