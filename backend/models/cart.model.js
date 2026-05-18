const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

const buildVariantKey = ({ productId, size = "", topSize = "", bottomSize = "", color = "", variantIdx = "" }) =>
  [productId, size, topSize, bottomSize, color, variantIdx ?? ""].join("|").toLowerCase();

const Cart = createMysqlDocumentModel("Cart", {
  statics: {
    buildVariantKey,
    async clearCart(userId) {
      return this.findOneAndUpdate({ userId }, { $set: { items: [] } }, { upsert: true, new: true });
    },
    async addOrUpdateItem(userId, item) {
      const cart = (await this.findOne({ userId })) || new this({ userId, items: [] });
      cart.items = Array.isArray(cart.items) ? cart.items : [];
      const variantKey = item.variantKey || buildVariantKey(item);
      const existing = cart.items.find((row) => row.variantKey === variantKey);
      if (existing) existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 1);
      else cart.items.push({ ...item, variantKey });
      await cart.save();
      return cart;
    },
  },
});

module.exports = Cart;
