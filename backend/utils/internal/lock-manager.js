const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * PRODUCTION-GRADE LOCKFILE MANAGER
 * 
 * Responsibilities:
 * 1. Prevent duplicate server instances.
 * 2. Handle stale lockfiles from crashes.
 * 3. Atomic lock acquisition.
 * 4. Automatic cleanup on exit/signals.
 */

const LOCK_FILE = path.join(__dirname, '../../server.lock');

const lockManager = {
  /**
   * Acquire the server lock
   * @returns {void}
   * @throws {Error} if another instance is already running
   */
  acquireLock() {
    console.log(chalk.cyan('🔐 Checking server lock...'));

    if (fs.existsSync(LOCK_FILE)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        const { pid, timestamp } = lockData;

        // Check if process is still running
        try {
          process.kill(pid, 0); 
          
          console.error(chalk.red.bold('\n❌ ERROR: SERVER ALREADY RUNNING'));
          console.error(chalk.red(`   - Existing Instance PID: ${pid}`));
          console.error(chalk.red(`   - Started At: ${timestamp}`));
          console.error(chalk.red(`   - Conflict: New attempt from PID ${process.pid}\n`));
          
          process.exit(1);
        } catch (e) {
          if (e.code === 'ESRCH') {
            // Process definitely dead
            console.log(chalk.yellow(`⚠️ Detected stale lockfile from crashed PID ${pid}. Cleaning up...`));
            this.releaseLock();
          } else {
            // Permission error or other - assume it's alive and running
            console.error(chalk.red.bold('\n❌ ERROR: SERVER LOCK ACQUISITION FAILED'));
            console.error(chalk.red(`   - Existing Instance PID: ${pid}`));
            console.error(chalk.red(`   - Reason: Process is running but inaccessible (Error: ${e.code})\n`));
            process.exit(1);
          }
        }
      } catch (parseError) {
        // Corrupted lockfile, remove it
        console.log(chalk.yellow('⚠️ Detected corrupted lockfile. Cleaning up...'));
        this.releaseLock();
      }
    }

    // Create new lock
    const content = JSON.stringify({
      pid: process.pid,
      timestamp: new Date().toISOString(),
      cwd: process.cwd()
    }, null, 2);

    try {
      fs.writeFileSync(LOCK_FILE, content, { flag: 'wx' }); // 'wx' fails if file exists (atomic)
      console.log(chalk.green(`✅ Lock acquired (PID: ${process.pid})\n`));
    } catch (e) {
      if (e.code === 'EEXIST') {
        // Race condition: someone else created it between our existsSync and writeFileSync
        console.error(chalk.red('❌ Race condition detected: Another instance just started.'));
        process.exit(1);
      }
      throw e;
    }
  },

  /**
   * Safely release the lock
   */
  releaseLock(reason = 'unknown') {
    if (fs.existsSync(LOCK_FILE)) {
      try {
        fs.unlinkSync(LOCK_FILE);
        console.log(chalk.yellow(`🔓 Lock released (Reason: ${reason})`));
      } catch (e) {
        // Ignore errors if file already deleted
      }
    }
  },

  /**
   * Setup automated cleanup handlers
   */
  setupCleanup() {
    const signals = ['SIGINT', 'SIGTERM'];
    
    signals.forEach(sig => {
      process.on(sig, () => {
        this.releaseLock(sig);
      });
    });

    process.on('exit', (code) => {
      this.releaseLock(`exit code ${code}`);
    });

    // Handle crashes
    process.on('uncaughtException', (err) => {
      this.releaseLock(`uncaughtException: ${err.message}`);
    });

    process.on('unhandledRejection', (reason) => {
      this.releaseLock(`unhandledRejection`);
    });
  }
};

module.exports = lockManager;
