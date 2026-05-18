const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("RefreshToken", {
  statics: {
    revokeByJti(jti) {
      return this.updateOne({ jti }, { $set: { revokedAt: new Date().toISOString() } });
    },
    revokeAllForUser(userId) {
      return this.updateMany({ userId }, { $set: { revokedAt: new Date().toISOString() } });
    },
    findActiveByJti(jti) {
      return this.findOne({ jti, revokedAt: { $exists: false } });
    },
  },
});
