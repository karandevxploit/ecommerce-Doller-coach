const BaseRepository = require("./base.repository");
const Address = require("../models/address.model");

class AddressRepository extends BaseRepository {
  constructor() {
    super(Address);
  }

  async findByUser(userId) {
    return await this.model.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  async unsetDefaults(userId) {
    return await this.model.updateMany({ userId }, { isDefault: false });
  }

  async findByUserIdAndId(userId, id) {
    return await this.model.findOne({ _id: id, userId });
  }
}

module.exports = new AddressRepository();
