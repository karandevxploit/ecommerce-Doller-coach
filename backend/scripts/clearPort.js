const { execSync } = require('child_process');

const PORT = 8001;

function clearPort() {
  try {
    const isWin = process.platform === "win32";
    if (isWin) {
      // Find PID on Port and Taskkill
      const cmd = `netstat -ano | findstr :${PORT} | findstr LISTENING`;
      const output = execSync(cmd).toString();
      const lines = output.trim().split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          console.log(`[Startup] Killing zombie process ${pid} on port ${PORT}...`);
          execSync(`taskkill /F /PID ${pid}`);
        }
      });
    } else {
      execSync(`lsof -t -i:${PORT} | xargs kill -9`);
    }
  } catch (err) {
    // Silently fail if no process found
  }
}

clearPort();
