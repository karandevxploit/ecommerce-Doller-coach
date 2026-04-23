/**
 * GLOBAL REQUEST DEDUPLICATOR
 * Prevents the same expensive database or external call from running multiple times concurrently.
 */

class InFlightManager {
  constructor() {
    this.map = new Map();
  }

  /**
   * WRAP AN OPERATION
   * @param {string} key Unique key for this specific request
   * @param {Function} taskFn The async function to execute
   */
  async run(key, taskFn) {
    // 1. Check if same operation is already running
    if (this.map.has(key)) {
      return this.map.get(key);
    }

    // 2. Wrap task in a promise that cleans up after itself
    const taskPromise = (async () => {
      try {
        return await taskFn();
      } finally {
        this.map.delete(key);
      }
    })();

    // 3. Register the promise
    this.map.set(key, taskPromise);
    return taskPromise;
  }
}

module.exports = new InFlightManager();
