// Fast, non-blocking object sanitizer for JSON payloads
// Strips MongoDB specific overhead (__v) and normalizes _id -> id
function sanitize(obj) {
  try {
    if (obj === null || typeof obj !== 'object') return obj;

    // 🔥 DETECT SPECIAL OBJECTS: Force to string immediately
    // Handles MongoDB ObjectIds and other similar custom class instances
    if (obj.constructor && obj.constructor.name === 'ObjectId') {
      return String(obj);
    }

    // Convert Mongoose Docs to raw JS objects instantly
    if (typeof obj.toObject === 'function') {
      obj = obj.toObject();
    }

    // Arrays: recursion
    if (Array.isArray(obj)) return obj.map(sanitize);

    // Filter out plain objects only
    const clean = {};
    for (const key in obj) {
      if (key === '__v') continue;
      if (key === 'password' || key === 'resetPasswordToken') continue;

      // Force normalize ID fields to strings
      if (key === '_id' || key === 'id') {
        clean[key] = obj[key] ? String(obj[key]) : obj[key];
        if (key === '_id') clean['id'] = String(obj[key]);
      } else {
        const value = obj[key];
        
        // Only recurse if it's a real object/array, not a primitive or special instance
        if (value && typeof value === 'object') {
           // check for ObjectId again for deep nested fields
           if (value.constructor && value.constructor.name === 'ObjectId') {
             clean[key] = String(value);
           } else {
             clean[key] = sanitize(value);
           }
        } else {
          clean[key] = value;
        }
      }
    }
    return clean;
  } catch (error) {
    return obj;
  }
}

/** Standard API envelope: { success, data, message } */
function ok(res, data = null, message = "", status = 200, meta = undefined) {
  if (res.headersSent) return;
  try {
    const cleanData = data !== null ? sanitize(data) : null;
    const response = { success: true, data: cleanData, message };
    
    // Add meta if provided
    if (meta !== undefined) {
      response.meta = meta;
    }
    
    // Ensure consistent response format for frontend
    return res.status(status).json(response);
  } catch (error) {
    // Fallback response if sanitization fails
    return res.status(status).json({
      success: true,
      data: data, // Return original data
      message: message || "Operation completed",
      ...(meta && { meta })
    });
  }
}

function fail(res, message = "Request failed", status = 400, errors = null) {
  if (res.headersSent) return;
  try {
    const response = { success: false, data: null, message };
    
    // Add detailed errors if provided
    if (errors) {
      response.errors = errors;
    }
    
    return res.status(status).json(response);
  } catch (error) {
    // Ultimate fallback
    return res.status(status).json({
      success: false,
      data: null,
      message: message || "Request failed"
    });
  }
}

/** Enhanced error response for validation errors */
function validationError(res, message = "Validation failed", errors = {}, status = 400) {
  return fail(res, message, status, errors);
}

/** Success response with pagination metadata */
function paginated(res, data = [], message = "", pagination = {}, status = 200) {
  return ok(res, data, message, status, pagination);
}

module.exports = { ok, fail, sanitize, validationError, paginated };
