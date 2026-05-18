const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Otp", {
  statics: {
    createOtp(data) {
      return this.create(data);
    },
    async verifyOtp({ email, phone, otp, purpose }) {
      const query = { otp, purpose, isUsed: { $ne: true } };
      if (email) query.email = email;
      if (phone) query.phone = phone;
      const doc = await this.findOne(query);
      if (doc) {
        doc.isUsed = true;
        await doc.save();
      }
      return doc;
    },
  },
});
