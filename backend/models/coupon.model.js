const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Coupon", {
  statics: {
    async applyCoupon({ code }) {
      return this.findOneAndUpdate({ code, isDeleted: { $ne: true } }, { $inc: { usedCount: 1 } }, { new: true });
    },
  },
});
