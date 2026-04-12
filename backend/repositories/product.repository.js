const BaseRepository = require("./base.repository");
const Product = require("../models/product.model");

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  async findBySlug(slug) {
    return await this.model.findOne({ slug });
  }

  async updateStock(productId, quantity, options = {}) {
    // quantity can be negative to decrease stock
    return await this.model.findByIdAndUpdate(
      productId,
      { $inc: { stock: quantity } },
      { new: true, ...options }
    );
  }
}

module.exports = new ProductRepository();
