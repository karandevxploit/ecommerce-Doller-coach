const WINDOW_MS = 60 * 1000;

const metrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  totalLatencyMs: 0,
  slowCount: 0,
  window: [],
};

const pruneWindow = (now) => {
  while (metrics.window.length && now - metrics.window[0].ts > WINDOW_MS) {
    metrics.window.shift();
  }
};

const recordRequest = ({ statusCode, latencyMs }) => {
  const now = Date.now();
  metrics.requestCount += 1;
  metrics.totalLatencyMs += latencyMs;
  if (latencyMs > 500) metrics.slowCount += 1;
  if (statusCode >= 500) metrics.errorCount += 1;

  metrics.window.push({
    ts: now,
    isError: statusCode >= 500,
  });
  pruneWindow(now);
};

const snapshot = () => {
  const now = Date.now();
  pruneWindow(now);
  const windowRequests = metrics.window.length;
  const windowErrors = metrics.window.filter((x) => x.isError).length;
  return {
    uptimeMs: now - metrics.startTime,
    requestCount: metrics.requestCount,
    errorCount: metrics.errorCount,
    avgLatencyMs:
      metrics.requestCount > 0
        ? Number((metrics.totalLatencyMs / metrics.requestCount).toFixed(2))
        : 0,
    slowCount: metrics.slowCount,
    errorRate1m:
      windowRequests > 0
        ? Number(((windowErrors / windowRequests) * 100).toFixed(2))
        : 0,
    requestRate1m: windowRequests,
  };
};

module.exports = {
  recordRequest,
  snapshot,
};
