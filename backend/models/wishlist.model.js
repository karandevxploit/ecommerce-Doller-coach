const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Wishlist", {
  statics: {
    async addItem(userId, productId) {
      const wishlist = (await this.findOne({ userId })) || new this({ userId, items: [] });
      wishlist.items = Array.isArray(wishlist.items) ? wishlist.items : [];
      if (!wishlist.items.some((item) => String(item.productId) === String(productId))) {
        wishlist.items.push({ productId, addedAt: new Date().toISOString() });
      }
      await wishlist.save();
      return wishlist;
    },
    removeItem(userId, productId) {
      return this.updateOne({ userId }, { $pull: { items: { productId } } });
    },
    async toggleItem(userId, productId) {
      const wishlist = (await this.findOne({ userId })) || new this({ userId, items: [] });
      wishlist.items = Array.isArray(wishlist.items) ? wishlist.items : [];
      const exists = wishlist.items.some((item) => String(item.productId) === String(productId));
      wishlist.items = exists
        ? wishlist.items.filter((item) => String(item.productId) !== String(productId))
        : [...wishlist.items, { productId, addedAt: new Date().toISOString() }];
      await wishlist.save();
      return { wishlist, added: !exists };
    },
  },
});
