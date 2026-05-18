const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Offer", {
  statics: {
    applyOffer({ couponCode }) {
      return this.findOneAndUpdate({ couponCode, isDeleted: { $ne: true } }, { $inc: { usedCount: 1 } }, { new: true });
    },
  },
});
