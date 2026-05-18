const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("PendingUser", {
  statics: {
    createPendingUser(data) {
      return this.create(data);
    },
    async verifyOtp({ email, otp }) {
      return this.findOne({ email, otp, isVerified: { $ne: true } });
    },
  },
});
