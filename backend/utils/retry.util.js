const logger = require("./logger");

/**
 * High-Reliability Wrapper: Executes an async function with exponential backoff retries.
 * Useful for flaky external API calls (Razorpay, Email providers, etc.)
 * 
 * @param {Function} fn - The async function to execute.
 * @param {Object} options - Retry configuration.
 * @param {number} options.maxRetries - Maximum number of attempts before throwing.
 * @param {number} options.baseDelay - Initial delay in milliseconds.
 * @param {number} options.factor - Exponential growth factor for delay.
 * @param {string} options.taskName - Logging identifier.
 */
const withRetry = async (fn, { 
    maxRetries = 3, 
    baseDelay = 500, 
    factor = 2, 
    taskName = "Task" 
} = {}) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      // If this was the last attempt, don't sleep, just exit loop
      if (attempt >= maxRetries) break;

      const delay = baseDelay * Math.pow(factor, attempt - 1);
      logger.warn(`[RETRY] ${taskName} attempt ${attempt} failed. Retrying in ${delay}ms...`, { 
          error: err.message 
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.error(`[RETRY] ${taskName} failed permanently after ${maxRetries} attempts.`);
  throw lastError;
};

module.exports = { withRetry };
