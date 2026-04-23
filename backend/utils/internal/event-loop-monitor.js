/**
 * Event Loop Safety Monitor
 * Detects blocking operations and provides real-time performance metrics
 */

const { performance } = require('perf_hooks');
const { logger } = require('../logger');

class EventLoopMonitor {
  constructor(options = {}) {
    this.threshold = options.threshold || 50; // 50ms lag threshold
    this.sampleInterval = options.sampleInterval || 10; // 10ms sampling
    this.historySize = options.historySize || 1000;
    this.alerts = [];
    this.history = [];
    this.isMonitoring = false;
    this.lastTime = performance.now();
    this.blockingOperations = new Map();
  }

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('[EVENT_LOOP] Monitoring started');
    
    this.interval = setInterval(() => {
      const now = performance.now();
      const lag = now - this.lastTime - this.sampleInterval;
      
      this.history.push({
        timestamp: now,
        lag: Math.max(0, lag),
        memory: process.memoryUsage()
      });

      // Keep history size bounded
      if (this.history.length > this.historySize) {
        this.history.shift();
      }

      // Detect blocking operations
      if (lag > this.threshold) {
        this.handleBlockingEvent(lag);
      }

      this.lastTime = now;
    }, this.sampleInterval);
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    clearInterval(this.interval);
    logger.info('[EVENT_LOOP] Monitoring stopped');
  }

  handleBlockingEvent(lag) {
    const stack = new Error().stack;
    const timestamp = new Date().toISOString();
    
    // Identify potential blocking patterns
    const blockingPatterns = [
      { pattern: /sync.*file/i, operation: 'Synchronous File I/O' },
      { pattern: /JSON\.parse|JSON\.stringify/, operation: 'Large JSON Processing' },
      { pattern: /find.*aggregate/i, operation: 'Heavy Database Query' },
      { pattern: /crypto\./i, operation: 'Cryptographic Operation' },
      { pattern: /for.*while/i, operation: 'Synchronous Loop' }
    ];

    let detectedOperation = 'Unknown Blocking Operation';
    for (const { pattern, operation } of blockingPatterns) {
      if (pattern.test(stack)) {
        detectedOperation = operation;
        break;
      }
    }

    const alert = {
      timestamp,
      lag: Math.round(lag * 100) / 100,
      operation: detectedOperation,
      stack: stack.split('\n').slice(2, 6).join('\n'), // First 4 relevant lines
      memory: process.memoryUsage()
    };

    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    logger.warn(`[EVENT_LOOP] BLOCKING DETECTED: ${detectedOperation} (${Math.round(lag)}ms)`);
    
    // Auto-detect patterns and suggest fixes
    this.suggestOptimizations(alert);
  }

  suggestOptimizations(alert) {
    const suggestions = {
      'Synchronous File I/O': 'Use fs.promises or stream-based operations',
      'Large JSON Processing': 'Use streaming JSON parser or chunk processing',
      'Heavy Database Query': 'Add indexes, use lean queries, or implement pagination',
      'Cryptographic Operation': 'Move to worker thread or use async alternatives',
      'Synchronous Loop': 'Replace with async/await or process in batches'
    };

    const suggestion = suggestions[alert.operation];
    if (suggestion) {
      logger.info(`[EVENT_LOOP] OPTIMIZATION SUGGESTION: ${suggestion}`);
    }
  }

  getMetrics() {
    if (this.history.length === 0) return null;

    const lags = this.history.map(h => h.lag);
    const memoryUsage = this.history.map(h => h.memory.heapUsed);

    return {
      currentLag: lags[lags.length - 1] || 0,
      avgLag: lags.reduce((a, b) => a + b, 0) / lags.length,
      maxLag: Math.max(...lags),
      p95Lag: this.percentile(lags, 0.95),
      memoryGrowth: memoryUsage[memoryUsage.length - 1] - memoryUsage[0],
      blockingEvents: this.alerts.length,
      uptime: process.uptime()
    };
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  generateReport() {
    const metrics = this.getMetrics();
    if (!metrics) return 'No data available';

    const report = `
🔍 EVENT LOOP PERFORMANCE REPORT
================================
Current Lag: ${metrics.currentLag.toFixed(2)}ms
Average Lag: ${metrics.avgLag.toFixed(2)}ms
Max Lag: ${metrics.maxLag.toFixed(2)}ms
95th Percentile: ${metrics.p95Lag.toFixed(2)}ms
Memory Growth: ${(metrics.memoryGrowth / 1024 / 1024).toFixed(2)}MB
Blocking Events: ${metrics.blockingEvents}
Uptime: ${Math.floor(metrics.uptime / 60)}m

RECENT BLOCKING EVENTS:
${this.alerts.slice(-5).map(alert => 
  `- ${alert.timestamp}: ${alert.operation} (${alert.lag}ms)`
).join('\n')}

PERFORMANCE STATUS: ${metrics.maxLag > 100 ? '⚠️ DEGRADED' : '✅ HEALTHY'}
    `.trim();

    return report;
  }

  // Middleware to monitor specific routes
  routeMonitor() {
    return (req, res, next) => {
      const startTime = performance.now();
      const originalEnd = res.end;
      
      res.end = function(...args) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (duration > 1000) { // 1 second threshold
          logger.warn(`[SLOW_ROUTE] ${req.method} ${req.originalUrl}: ${Math.round(duration)}ms`);
        }
        
        originalEnd.apply(this, args);
      };
      
      next();
    };
  }
}

// Global instance for monitoring
const monitor = new EventLoopMonitor({
  threshold: 50,
  sampleInterval: 10,
  historySize: 1000
});

// Auto-start in production
// Auto-start disabled to prevent duplicate loops
// if (process.env.NODE_ENV === 'production') {
//   monitor.start();
// }

module.exports = monitor;
