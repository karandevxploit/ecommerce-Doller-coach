/**
 * Generic Pagination Helper
 * @param {Object} query - Mongoose query object
 * @param {Object} options - { page, limit, sort }
 */
const paginate = async (model, query = {}, options = {}) => {
  const page = Math.max(1, parseInt(options.page) || 1);
  const limit = Math.max(1, parseInt(options.limit) || 10);
  const sort = options.sort || { createdAt: -1 };
  const populate = options.populate || "";
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.find(query).sort(sort).skip(skip).limit(limit).populate(populate).lean(),
    model.countDocuments(query),
  ]);

  const pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
};

module.exports = paginate;
