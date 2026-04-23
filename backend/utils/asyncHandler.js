const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (res.headersSent) return next(err);
    next(err);
  });
};

module.exports = asyncHandler;
