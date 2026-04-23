/**
 * Memory Stability Monitor
 * Detects memory leaks and tracks memory growth patterns
 */

const { logger } = require('../logger');
const { performance } = require('perf_hooks');

class MemoryMonitor {
  constructor(options = {}) {
    this.sampleInterval = options.sampleInterval || 10000; // 10 seconds
    this.historySize = options.historySize || 360; // 1 hour at 10s intervals
    this.samples = [];
    this.baseline = null;
    this.alerts = [];
    this.isMonitoring = false;
    this.leakThreshold = options.leakThreshold || 50; // 50MB growth
    this.heapThreshold = options.heapThreshold || 500; // 500MB warning
  }

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    logger.info('[MEMORY] Monitoring started');
    
    // Establish baseline after first sample
    this.interval = setInterval(() => {
      this.collectSample();
    }, this.sampleInterval);
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    clearInterval(this.interval);
    logger.info('[MEMORY] Monitoring stopped');
  }

  collectSample() {
    const usage = process.memoryUsage();
    const timestamp = performance.now();
    
    const sample = {
      timestamp,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
    };

    this.samples.push(sample);

    // Set baseline after first sample
    if (!this.baseline) {
      this.baseline = { ...sample };
      logger.info(`[MEMORY] Baseline established: ${sample.heapUsed}MB heap`);
    }

    // Keep history bounded
    if (this.samples.length > this.historySize) {
      this.samples.shift();
    }

    // Check for memory issues
    this.analyzeSample(sample);
  }

  analyzeSample(sample) {
    // Immediate threshold checks
    if (sample.heapUsed > this.heapThreshold) {
      this.createAlert('HIGH_HEAP', `Heap usage: ${sample.heapUsed}MB`, sample);
    }

    // Memory leak detection (growth over time)
    if (this.samples.length >= 6) { // 1 minute of data
      const recent = this.samples.slice(-6);
      const oldest = recent[0];
      const growth = sample.heapUsed - oldest.heapUsed;

      if (growth > this.leakThreshold) {
        this.createAlert('MEMORY_LEAK', `Memory growth: +${growth}MB in 1min`, sample);
      }
    }

    // Long-term growth analysis
    if (this.samples.length >= 36) { // 6 minutes of data
      const recent = this.samples.slice(-36);
      const oldest = recent[0];
      const growth = sample.heapUsed - oldest.heapUsed;

      if (growth > this.leakThreshold * 2) {
        this.createAlert('SUSTAINED_GROWTH', `Sustained growth: +${growth}MB in 6min`, sample);
      }
    }

    // Garbage collection pressure detection
    const recentSamples = this.samples.slice(-10);
    const heapVariance = this.calculateVariance(recentSamples.map(s => s.heapUsed));
    
    if (heapVariance > 100) { // High variance suggests GC pressure
      this.createAlert('GC_PRESSURE', `High heap variance: ${heapVariance.toFixed(2)}`, sample);
    }
  }

  createAlert(type, message, sample) {
    const alert = {
      timestamp: new Date().toISOString(),
      type,
      message,
      heapUsed: sample.heapUsed,
      heapTotal: sample.heapTotal,
      external: sample.external
    };

    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 20) {
      this.alerts.shift();
    }

    logger.warn(`[MEMORY] ${type}: ${message}`);
    
    // Trigger GC if memory is critical
    if (sample.heapUsed > this.heapThreshold * 1.5) {
      logger.warn('[MEMORY] Triggering manual garbage collection');
      if (global.gc) {
        global.gc();
      }
    }
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  getMetrics() {
    if (this.samples.length === 0) return null;

    const heapUsages = this.samples.map(s => s.heapUsed);
    const current = this.samples[this.samples.length - 1];
    
    return {
      currentHeap: current.heapUsed,
      currentTotal: current.heapTotal,
      avgHeap: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
      maxHeap: Math.max(...heapUsages),
      minHeap: Math.min(...heapUsages),
      heapGrowth: current.heapUsed - this.baseline.heapUsed,
      totalGrowth: current.heapUsed - this.samples[0].heapUsed,
      sampleCount: this.samples.length,
      alerts: this.alerts.length,
      uptime: process.uptime()
    };
  }

  generateReport() {
    const metrics = this.getMetrics();
    if (!metrics) return 'No data available';

    const report = `
🧠 MEMORY PERFORMANCE REPORT
==============================
Current Heap: ${metrics.currentHeap}MB
Heap Total: ${metrics.currentTotal}MB
Average Heap: ${metrics.avgHeap.toFixed(2)}MB
Max Heap: ${metrics.maxHeap}MB
Min Heap: ${metrics.minHeap}MB
Baseline Growth: +${metrics.heapGrowth}MB
Total Growth: +${metrics.totalGrowth}MB
Samples: ${metrics.sampleCount}
Alerts: ${metrics.alerts}
Uptime: ${Math.floor(metrics.uptime / 60)}m

RECENT ALERTS:
${this.alerts.slice(-5).map(alert => 
  `- ${alert.timestamp}: ${alert.type} - ${alert.message}`
).join('\n')}

MEMORY STATUS: ${metrics.currentHeap > this.heapThreshold ? '⚠️ HIGH USAGE' : '✅ HEALTHY'}
    `.trim();

    return report;
  }

  // Force garbage collection if available
  forceGC() {
    if (global.gc) {
      logger.info('[MEMORY] Manual garbage collection triggered');
      global.gc();
      return true;
    } else {
      logger.warn('[MEMORY] Manual GC not available (run with --expose-gc)');
      return false;
    }
  }

  // Get memory usage by process components
  getDetailedUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
    };
  }
}

// Global instance
const monitor = new MemoryMonitor({
  sampleInterval: 10000,
  historySize: 360,
  leakThreshold: 50,
  heapThreshold: 500
});

// Auto-start in production
// Auto-start disabled to prevent duplicate loops (Consolidated in utils/monitor.js)
// if (process.env.NODE_ENV === 'production') {
//   monitor.start();
// }

module.exports = monitor;
