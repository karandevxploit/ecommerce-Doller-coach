const { spawnSync } = require("child_process");
const os = require("os");

const PORT = Number(process.env.PORT) || 8001;
const APP_IDENTIFIER = "node"; // or your app name

/**
 * SAFE EXEC
 */
function run(cmd, args = []) {
  return spawnSync(cmd, args, { encoding: "utf-8" });
}

/**
 * GET PIDS USING PORT
 */
function getPids() {
  try {
    if (process.platform === "win32") {
      const res = run("netstat", ["-ano"]);
      const lines = res.stdout.split("\n");

      return lines
        .filter(line => line.includes(`:${PORT}`) && line.includes("LISTENING"))
        .map(line => line.trim().split(/\s+/).pop())
        .filter(pid => pid && !isNaN(pid));
    } else {
      const res = run("lsof", ["-t", `-i:${PORT}`]);
      return res.stdout
        .split("\n")
        .map(pid => pid.trim())
        .filter(pid => pid);
    }
  } catch {
    return [];
  }
}

/**
 * CHECK PROCESS NAME (SAFE FILTER)
 */
function isOurProcess(pid) {
  try {
    if (process.platform === "win32") {
      const res = run("tasklist", ["/FI", `PID eq ${pid}`]);
      return res.stdout.toLowerCase().includes(APP_IDENTIFIER);
    } else {
      const res = run("ps", ["-p", pid, "-o", "comm="]);
      return res.stdout.toLowerCase().includes(APP_IDENTIFIER);
    }
  } catch {
    return false;
  }
}

/**
 * KILL PROCESS SAFELY
 */
function killProcess(pid) {
  try {
    console.log(`[Startup] Attempting graceful shutdown of PID ${pid}...`);
    process.kill(pid, "SIGTERM");

    // wait briefly
    setTimeout(() => {
      try {
        process.kill(pid, 0); // still alive?
        console.warn(`[Startup] Force killing PID ${pid}`);
        process.kill(pid, "SIGKILL");
      } catch { }
    }, 2000);

  } catch (err) {
    console.warn(`[Startup] Failed to kill PID ${pid}: ${err.message}`);
  }
}

/**
 * MAIN
 */
function clearPort() {
  const pids = getPids();

  if (!pids.length) {
    console.log(`[Startup] Port ${PORT} is free.`);
    return;
  }

  pids.forEach(pid => {
    if (isOurProcess(pid)) {
      killProcess(Number(pid));
    } else {
      console.warn(
        `[Startup] Skipping PID ${pid} (not owned by this app)`
      );
    }
  });
}

clearPort();