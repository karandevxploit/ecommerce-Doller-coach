const { logger } = require("../utils/logger");

/**
 * PRODUCTION CIRCUIT BREAKER
 * Prevents cascading failures when external services (Shiprocket/Razorpay) go down.
 */

class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000; // 30s pause

    this.state = "CLOSED"; // CLOSED (Working), OPEN (Failing), HALF_OPEN (Testing)
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
  }

  async execute(fn, ...args) {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
        logger.info(`[CIRCUIT_BREAKER] ${this.serviceName} transition to HALF_OPEN`);
      } else {
        throw new Error(`Circuit Breaker [${this.serviceName}] is OPEN. Service unavailable.`);
      }
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  onSuccess() {
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.reset();
        logger.info(`[CIRCUIT_BREAKER] ${this.serviceName} restored to CLOSED`);
      }
    } else {
      this.failures = 0;
    }
  }

  onFailure(err) {
    this.failures++;
    logger.warn(`[CIRCUIT_BREAKER] ${this.serviceName} Failure Count: ${this.failures}`, { error: err.message });

    if (this.failures >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      logger.error(`[CIRCUIT_BREAKER] ${this.serviceName} is now OPEN. Sleeping for ${this.timeout}ms`);
    }
  }

  reset() {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
  }
}

// Global Registry for Circuit Breakers
const breakers = {
    shiprocket: new CircuitBreaker("Shiprocket", { failureThreshold: 3 }),
    payment: new CircuitBreaker("PaymentGateway", { failureThreshold: 3 }),
    email: new CircuitBreaker("EmailService", { failureThreshold: 5 })
};

module.exports = { CircuitBreaker, breakers };
