const { validationResult } = require("express-validator");

// ===============================
// HELPER: FORMAT ERRORS
// ===============================
const formatErrors = (errors) => {
  const formatted = {};

  errors.forEach((err) => {
    const field = err.param || "unknown";

    // Avoid duplicate messages per field
    if (!formatted[field]) {
      formatted[field] = err.msg;
    }
  });

  return formatted;
};

// ===============================
// VALIDATION MIDDLEWARE
// ===============================
const validate = (req, res, next) => {
  if (res.headersSent) return;

  const result = validationResult(req);

  if (!result.isEmpty()) {
    const requestId = req.requestId || "unknown";

    const errors = formatErrors(result.array());

    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid request data",
      errors,
      requestId,
    });
  }

  next();
};

module.exports = validate;