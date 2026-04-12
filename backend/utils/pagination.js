/**
 * Cursor-based Pagination helper (Infinite Scroll style)
 * @param {Object} model - Mongoose model
 * @param {Object} query - Base filter
 * @param {Object} options - { limit, cursor, sort='_id' }
 */
const cursorPaginate = async (model, query = {}, options = {}) => {
  const limit = Math.max(1, parseInt(options.limit) || 20);
  const cursor = options.cursor; // The _id of the last item in the previous page
  const sortField = options.sortField || "_id";
  const sortDirection = options.sortOrder === "asc" ? 1 : -1;

  // Add cursor condition to query
  const cursorQuery = { ...query };
  if (cursor) {
    const operator = sortDirection === -1 ? "$lt" : "$gt";
    cursorQuery[sortField] = { [operator]: cursor };
  }

  const data = await model
    .find(cursorQuery)
    .sort({ [sortField]: sortDirection })
    .limit(limit + 1)
    .populate(options.populate || "")
    .lean();

  const hasNextPage = data.length > limit;
  const results = hasNextPage ? data.slice(0, -1) : data;
  const nextCursor = hasNextPage ? results[results.length - 1][sortField] : null;

  return {
    data: results,
    pagination: {
      nextCursor,
      hasNextPage,
      count: results.length,
    },
  };
};

/**
 * Legacy Skip-Limit Pagination (for Admin Dashboards)
 */
const paginate = async (model, query = {}, options = {}) => {
  const page = Math.max(1, parseInt(options.page) || 1);
  const limit = Math.max(1, parseInt(options.limit) || 10);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(options.populate || "")
      .lean(),
    model.countDocuments(query),
  ]);

  return {
    data,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

module.exports = { paginate, cursorPaginate };
