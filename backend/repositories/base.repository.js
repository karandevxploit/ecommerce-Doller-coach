class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data, options = {}) {
    return await this.model.create([data], options).then(res => res[0]);
  }

  async findById(id) {
    return await this.model.findById(id);
  }

  async findOne(query) {
    return await this.model.findOne(query);
  }

  async find(query = {}, options = {}) {
    const { sort = { createdAt: -1 }, limit = 20, skip = 0, populate = "" } = options;
    return await this.model.find(query).sort(sort).limit(limit).skip(skip).populate(populate).lean();
  }

  async updateById(id, data, options = {}) {
    return await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true, ...options });
  }

  async deleteById(id) {
    return await this.model.findByIdAndDelete(id);
  }

  async count(query = {}) {
    return await this.model.countDocuments(query);
  }
}

module.exports = BaseRepository;
