/**
 * Circuit Breaker Implementation
 * Protects external API calls from cascading failures
 */

const { structuredLog, alertSystem } = require('./logger');

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.expectedErrors = options.expectedErrors || [];
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
    this.nextAttempt = Date.now();
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      circuitOpens: 0,
      avgResponseTime: 0
    };
  }

  async execute(operation, timeout = 8000) {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.requestCount++;

    try {
      // Check if circuit is open
      if (this.state === 'OPEN') {
        if (Date.now() < this.nextAttempt) {
          const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
          error.code = 'CIRCUIT_OPEN';
          throw error;
        } else {
          // Transition to HALF_OPEN
          this.transitionToHalfOpen();
        }
      }

      // Execute operation with timeout
      const result = await this.withTimeout(operation, timeout);
      
      // Success
      this.onSuccess(Date.now() - startTime);
      return result;
      
    } catch (error) {
      this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  withTimeout(operation, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.metrics.timeouts++;
        const error = new Error(`Operation timeout after ${timeout}ms for ${this.name}`);
        error.code = 'TIMEOUT';
        reject(error);
      }, timeout);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  onSuccess(responseTime) {
    this.metrics.successfulRequests++;
    this.successCount++;
    
    // Update average response time
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
      this.metrics.successfulRequests;

    if (this.state === 'HALF_OPEN') {
      // Reset circuit on success in half-open state
      this.transitionToClosed();
    }

    // Reset failure count on success
    this.failureCount = Math.max(0, this.failureCount - 1);
  }

  onFailure(error, responseTime) {
    this.metrics.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Log failure
    structuredLog.error('Circuit Breaker Failure', {
      circuitName: this.name,
      error: error.message,
      code: error.code,
      state: this.state,
      failureCount: this.failureCount,
      responseTime
    });

    // Check if error is expected
    const isExpectedError = this.expectedErrors.some(expectedError => 
      error.code === expectedError || error.message.includes(expectedError)
    );

    if (!isExpectedError) {
      // Unexpected error - consider it a failure
      if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
        this.transitionToOpen();
      } else if (this.state === 'HALF_OPEN') {
        this.transitionToOpen();
      }
    }
  }

  transitionToClosed() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    
    structuredLog.business('Circuit Breaker Closed', {
      circuitName: this.name,
      resetTime: new Date().toISOString()
    });
  }

  transitionToOpen() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.metrics.circuitOpens++;
    
    structuredLog.warn('Circuit Breaker Opened', {
      circuitName: this.name,
      failureCount: this.failureCount,
      resetTimeout: this.resetTimeout,
      nextAttempt: new Date(this.nextAttempt).toISOString()
    });

    // Alert on circuit opening
    alertSystem.critical(`Circuit breaker opened for ${this.name}`, {
      failureCount: this.failureCount,
      resetTimeout: this.resetTimeout,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null
    });
  }

  transitionToHalfOpen() {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    
    structuredLog.info('Circuit Breaker Half-Open', {
      circuitName: this.name,
      testingPeriod: this.monitoringPeriod
    });
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      metrics: { ...this.metrics }
    };
  }

  reset() {
    this.transitionToClosed();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      circuitOpens: 0,
      avgResponseTime: 0
    };
  }
}

// Pre-configured circuit breakers for common services
const circuitBreakers = {
  email: new CircuitBreaker({
    name: 'email-service',
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    expectedErrors: ['RATE_LIMIT', 'INVALID_API_KEY']
  }),
  
  payment: new CircuitBreaker({
    name: 'payment-service',
    failureThreshold: 2,
    resetTimeout: 60000, // 1 minute
    expectedErrors: ['INSUFFICIENT_FUNDS', 'INVALID_CARD']
  }),
  
  googleAuth: new CircuitBreaker({
    name: 'google-auth',
    failureThreshold: 5,
    resetTimeout: 120000, // 2 minutes
    expectedErrors: ['INVALID_TOKEN', 'TOKEN_EXPIRED']
  }),
  
  recaptcha: new CircuitBreaker({
    name: 'recaptcha',
    failureThreshold: 10,
    resetTimeout: 300000, // 5 minutes
    expectedErrors: ['INVALID_SITE_KEY', 'MISSING_INPUT_SECRET']
  })
};

// Helper function to execute with circuit breaker
async function withCircuitBreaker(serviceName, operation, timeout) {
  const breaker = circuitBreakers[serviceName];
  if (!breaker) {
    throw new Error(`No circuit breaker configured for service: ${serviceName}`);
  }
  
  return await breaker.execute(operation, timeout);
}

// Get all circuit breaker states
function getAllCircuitBreakerStates() {
  return Object.values(circuitBreakers).map(breaker => breaker.getState());
}

// Reset all circuit breakers
function resetAllCircuitBreakers() {
  Object.values(circuitBreakers).forEach(breaker => breaker.reset());
  structuredLog.business('All Circuit Breakers Reset', {
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  CircuitBreaker,
  circuitBreakers,
  withCircuitBreaker,
  getAllCircuitBreakerStates,
  resetAllCircuitBreakers
};
