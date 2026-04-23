/**
 * Queue Monitoring and Stability Management
 * Monitors queue health, prevents retry storms, and manages worker balance
 */

const redisConfig = require('../../config/redis');
const { logger } = require('../logger');

class QueueMonitor {
  constructor(options = {}) {
    this.redis = redisConfig.rawClient;
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.alertThreshold = options.alertThreshold || 100;
    this.isMonitoring = false;
    this.stats = {
      emailQueue: { size: 0, processed: 0, failed: 0, lastCheck: null },
      notificationQueue: { size: 0, processed: 0, failed: 0, lastCheck: null }
    };
  }

  start() {
    if (this.isMonitoring || !this.redis) return;
    
    this.isMonitoring = true;
    logger.info('[QUEUE_MONITOR] Starting queue monitoring');
    
    this.interval = setInterval(() => {
      this.checkQueueHealth();
    }, this.checkInterval);

    // Initial check
    this.checkQueueHealth();
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    clearInterval(this.interval);
    logger.info('[QUEUE_MONITOR] Queue monitoring stopped');
  }

  async checkQueueHealth() {
    try {
      const queues = ['email-queue', 'notification-queue', 'analytics-queue', 'heavy-task-queue'];
      
      for (const queueName of queues) {
        await this.checkSingleQueue(queueName);
      }
      
      this.analyzeOverallHealth();
    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Health check failed: ${error.message}`);
    }
  }

  async checkSingleQueue(queueName) {
    try {
      // Get internal BullMQ metrics
      const [waiting, active, completed, failed] = await Promise.all([
        this.redis.llen(`bull:${queueName}:wait`),
        this.redis.llen(`bull:${queueName}:active`),
        this.redis.zcard(`bull:${queueName}:completed`),
        this.redis.zcard(`bull:${queueName}:failed`)
      ]);

      const stats = {
        size: waiting,
        active: active,
        completed: completed,
        failed: failed,
        timestamp: new Date().toISOString()
      };

      this.stats[`${queueName}Queue`] = stats;

      // Check for queue overflow
      if (waiting > this.maxQueueSize) {
        logger.warn(`[QUEUE_OVERFLOW] ${queueName}: ${waiting} jobs waiting (max: ${this.maxQueueSize})`);
        await this.handleQueueOverflow(queueName, waiting);
      }

      // Check for high failure rate
      const totalProcessed = completed + failed;
      if (totalProcessed > 0 && (failed / totalProcessed) > 0.1) { // 10% failure rate
        logger.warn(`[QUEUE_HIGH_FAILURE] ${queueName}: ${Math.round((failed / totalProcessed) * 100)}% failure rate`);
        await this.handleHighFailureRate(queueName, failed, totalProcessed);
      }

      // Check for stalled jobs
      if (active > 50) { // Too many active jobs
        logger.warn(`[QUEUE_STALLED] ${queueName}: ${active} active jobs (possible stall)`);
        await this.handleStalledJobs(queueName, active);
      }

    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Failed to check ${queueName}: ${error.message}`);
    }
  }

  async handleQueueOverflow(queueName, size) {
    try {
      // Remove old jobs if queue is overflowing
      const jobsToRemove = Math.min(size - this.alertThreshold, 100);
      
      for (let i = 0; i < jobsToRemove; i++) {
        const jobData = await this.redis.lpop(`${queueName}:waiting`);
        if (jobData) {
          const job = JSON.parse(jobData);
          logger.warn(`[QUEUE_CLEANUP] Removing overflow job ${job.id} from ${queueName}`);
        }
      }
      
      logger.info(`[QUEUE_CLEANUP] Removed ${jobsToRemove} jobs from ${queueName} due to overflow`);
    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Failed to handle overflow for ${queueName}: ${error.message}`);
    }
  }

  async handleHighFailureRate(queueName, failed, total) {
    try {
      // Implement exponential backoff for failing queue
      const backoffKey = `${queueName}:backoff`;
      const currentBackoff = await this.redis.get(backoffKey) || 0;
      
      if (currentBackoff < 300) { // Max 5 minutes backoff
        const newBackoff = Math.min(parseInt(currentBackoff) + 60, 300);
        await this.redis.setex(backoffKey, newBackoff, newBackoff);
        
        logger.warn(`[QUEUE_BACKOFF] ${queueName}: Implementing ${newBackoff}s backoff due to high failure rate`);
      }
    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Failed to handle high failure rate for ${queueName}: ${error.message}`);
    }
  }

  async handleStalledJobs(queueName, activeCount) {
    try {
      // Check for jobs that have been active too long
      const activeJobs = await this.redis.lrange(`${queueName}:active`, 0, -1);
      
      for (const jobData of activeJobs) {
        try {
          const job = JSON.parse(jobData);
          const activeTime = Date.now() - (job.startedAt || Date.now());
          
          // If job has been active for more than 10 minutes, consider it stalled
          if (activeTime > 600000) { // 10 minutes
            logger.warn(`[QUEUE_STALLED_JOB] ${queueName}: Job ${job.id} stalled for ${Math.round(activeTime / 1000)}s`);
            
            // Move job back to waiting or mark as failed
            await this.redis.lrem(`${queueName}:active`, 1, jobData);
            
            if (job.attemptsMade < 3) {
              await this.redis.rpush(`${queueName}:waiting`, jobData);
              logger.info(`[QUEUE_RECOVER] Re-queuing stalled job ${job.id}`);
            } else {
              await this.redis.rpush(`${queueName}:failed`, jobData);
              logger.error(`[QUEUE_FAILED] Stalled job ${job.id} exceeded max attempts`);
            }
          }
        } catch (parseError) {
          // Skip malformed job data
          continue;
        }
      }
    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Failed to handle stalled jobs for ${queueName}: ${error.message}`);
    }
  }

  analyzeOverallHealth() {
    const emailStats = this.stats.emailQueue;
    const notificationStats = this.stats.notificationQueue;
    
    const totalWaiting = emailStats.size + notificationStats.size;
    const totalActive = emailStats.active + notificationStats.active;
    const totalFailed = emailStats.failed + notificationStats.failed;
    
    // Overall health assessment
    if (totalWaiting > this.alertThreshold) {
      logger.warn(`[QUEUE_HEALTH] High queue backlog: ${totalWaiting} jobs waiting`);
    }
    
    if (totalActive > 100) {
      logger.warn(`[QUEUE_HEALTH] High active job count: ${totalActive} jobs processing`);
    }
    
    if (totalFailed > 50) {
      logger.error(`[QUEUE_HEALTH] High failure count: ${totalFailed} failed jobs`);
    }
  }

  async getQueueStats() {
    if (!this.redis) {
      return { error: 'Redis not available' };
    }

    try {
      const queues = ['email-queue', 'notification-queue', 'analytics-queue', 'heavy-task-queue'];
      const stats = {};
      
      for (const queueName of queues) {
        const [waiting, active, completed, failed] = await Promise.all([
          this.redis.llen(`bull:${queueName}:wait`),
          this.redis.llen(`bull:${queueName}:active`),
          this.redis.zcard(`bull:${queueName}:completed`),
          this.redis.zcard(`bull:${queueName}:failed`)
        ]);
        
        stats[queueName] = {
          waiting,
          active,
          completed,
          failed,
          total: waiting + active + completed + failed
        };
      }
      
      return stats;
    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Failed to get queue stats: ${error.message}`);
      return { error: error.message };
    }
  }

  async clearQueue(queueName) {
    if (!this.redis) return false;
    
    try {
      await Promise.all([
        this.redis.del(`${queueName}:waiting`),
        this.redis.del(`${queueName}:active`),
        this.redis.del(`${queueName}:completed`),
        this.redis.del(`${queueName}:failed`)
      ]);
      
      logger.info(`[QUEUE_CLEAR] Cleared ${queueName}`);
      return true;
    } catch (error) {
      logger.error(`[QUEUE_MONITOR] Failed to clear ${queueName}: ${error.message}`);
      return false;
    }
  }

  generateReport() {
    const report = `
🔄 QUEUE STABILITY REPORT
============================
Email Queue:
  Waiting: ${this.stats.emailQueue.size}
  Active: ${this.stats.emailQueue.active}
  Completed: ${this.stats.emailQueue.completed}
  Failed: ${this.stats.emailQueue.failed}
  Last Check: ${this.stats.emailQueue.lastCheck || 'Never'}

Notification Queue:
  Waiting: ${this.stats.notificationQueue.size}
  Active: ${this.stats.notificationQueue.active}
  Completed: ${this.stats.notificationQueue.completed}
  Failed: ${this.stats.notificationQueue.failed}
  Last Check: ${this.stats.notificationQueue.lastCheck || 'Never'}

Overall Health:
  Total Waiting: ${this.stats.emailQueue.size + this.stats.notificationQueue.size}
  Total Active: ${this.stats.emailQueue.active + this.stats.notificationQueue.active}
  Total Failed: ${this.stats.emailQueue.failed + this.stats.notificationQueue.failed}

Status: ${this.getOverallStatus()}
    `.trim();

    return report;
  }

  getOverallStatus() {
    const totalWaiting = this.stats.emailQueue.size + this.stats.notificationQueue.size;
    const totalActive = this.stats.emailQueue.active + this.stats.notificationQueue.active;
    const totalFailed = this.stats.emailQueue.failed + this.stats.notificationQueue.failed;

    if (totalWaiting > this.alertThreshold || totalActive > 100 || totalFailed > 50) {
      return '⚠️ DEGRADED';
    } else if (totalWaiting > 10 || totalActive > 20 || totalFailed > 10) {
      return '⚠️ WARNING';
    } else {
      return '✅ HEALTHY';
    }
  }
}

// Global instance
const queueMonitor = new QueueMonitor({
  checkInterval: 30000,
  maxQueueSize: 1000,
  alertThreshold: 100
});

// Auto-start in production
// Auto-start disabled to prevent duplicate loops
// if (process.env.NODE_ENV === 'production') {
//   queueMonitor.start();
// }

// Add queue monitoring function to worker.js
function startQueueMonitoring() {
  if (!queueMonitor.isMonitoring) {
    queueMonitor.start();
  }
}

module.exports = queueMonitor;
module.exports.startQueueMonitoring = startQueueMonitoring;
