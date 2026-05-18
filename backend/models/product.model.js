const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

const money = (value) => Math.max(0, Math.round((Number(value) || 0) * 100) / 100);

const Product = createMysqlDocumentModel("Product", {
  statics: {
    async updateRating(productId, newRating) {
      const product = await this.findById(productId).lean();
      if (!product) return { matchedCount: 0, modifiedCount: 0 };

      const currentCount = Number(product.ratings?.count) || 0;
      const currentAverage = Number(product.ratings?.average) || 0;
      const nextCount = currentCount + 1;
      const nextAverage = money(((currentAverage * currentCount) + Number(newRating || 0)) / nextCount);

      return this.updateOne(
        { _id: productId },
        { $set: { rating: nextAverage, "ratings.average": nextAverage, "ratings.count": nextCount } }
      );
    },
  },
});

module.exports = Product;
