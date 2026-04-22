const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const LOCK_FILE = path.join(__dirname, "../server.lock");

/**
 * CONFIG
 */
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * CHECK PROCESS ALIVE + VALID
 */
const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== "ESRCH";
  }
};

/**
 * MAIN CLEANUP
 */
async function cleanup() {
  try {
    const exists = await fs
      .access(LOCK_FILE)
      .then(() => true)
      .catch(() => false);

    if (!exists) return;

    const raw = await fs.readFile(LOCK_FILE, "utf8");

    let lockData;
    try {
      lockData = JSON.parse(raw);
    } catch {
      console.warn("[Lock Cleanup] Corrupted lock file. Removing.");
      await fs.unlink(LOCK_FILE).catch(() => { });
      return;
    }

    const { pid, createdAt, hostname } = lockData;

    console.log(`[Lock Cleanup] Checking PID ${pid}...`);

    /**
     * TTL CHECK
     */
    const age = Date.now() - (createdAt || 0);

    if (age > LOCK_TTL_MS) {
      console.warn("[Lock Cleanup] Lock expired. Removing.");
      await fs.unlink(LOCK_FILE).catch(() => { });
      return;
    }

    /**
     * PROCESS CHECK
     */
    const alive = isProcessAlive(pid);

    if (!alive) {
      console.warn("[Lock Cleanup] Process dead. Removing stale lock.");
      await fs.unlink(LOCK_FILE).catch(() => { });
      return;
    }

    /**
     * HOST CHECK (important for distributed systems)
     */
    if (hostname && hostname !== os.hostname()) {
      console.warn(
        `[Lock Cleanup] Lock belongs to another host (${hostname}). Keeping.`
      );
      return;
    }

    console.log("[Lock Cleanup] Lock is valid. No action taken.");

  } catch (err) {
    console.error("[Lock Cleanup] Unexpected error:", err.message);
  }
}

cleanup();