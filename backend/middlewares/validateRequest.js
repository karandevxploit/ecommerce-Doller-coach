const AppError = require("../utils/AppError");

/**
 * Higher-order middleware to validate req body/query/params using Zod.
 * Returns detailed field-level errors if validation fails.
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Replace req objects with sanitized/validated data (only works if schema defines all expected fields)
    if (validated.body) req.body = validated.body;
    if (validated.query) req.query = validated.query;
    if (validated.params) req.params = validated.params;
    
    next();
  } catch (err) {
    if (err.name === "ZodError") {
      const fieldErrors = {};
      err.errors.forEach((e) => {
        const path = e.path.slice(1).join(".") || "error";
        fieldErrors[path] = e.message;
      });

      const message = "Validation failed for the requested resource.";
      const error = new AppError(message, 400, "VALIDATION_FAILED");
      error.errors = fieldErrors; // Attach structured errors
      return next(error);
    }
    next(err);
  }
};

module.exports = validateRequest;
