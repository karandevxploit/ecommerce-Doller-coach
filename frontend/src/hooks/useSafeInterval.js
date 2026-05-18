import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useSafeInterval
 * Reliable interval hook with:
 * - Auto cleanup
 * - Visibility pause/resume
 * - Async-safe execution
 * - Manual controls
 * - Optional immediate run
 */
export const useSafeInterval = (
  callback,
  delay,
  { immediate = false, pauseOnHidden = true } = {}
) => {
  const savedCallback = useRef(callback);
  const intervalRef = useRef(null);
  const isExecutingRef = useRef(false);
  const shouldRunRef = useRef(false);

  const [isRunning, setIsRunning] = useState(false);

  const isValidDelay =
    typeof delay === "number" && Number.isFinite(delay) && delay >= 0;

  /* ---------------- STORE LATEST CALLBACK ---------------- */
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  /* ---------------- EXECUTION ---------------- */
  const tick = useCallback(async () => {
    if (typeof savedCallback.current !== "function") return;
    if (isExecutingRef.current) return;

    isExecutingRef.current = true;

    try {
      await savedCallback.current();
    } catch (err) {
      console.error("[useSafeInterval] Execution error:", err);
    } finally {
      isExecutingRef.current = false;
    }
  }, []);

  /* ---------------- CLEAR ---------------- */
  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /* ---------------- START ---------------- */
  const start = useCallback(() => {
    if (!isValidDelay) return;

    shouldRunRef.current = true;

    if (pauseOnHidden && typeof document !== "undefined" && document.hidden) {
      setIsRunning(false);
      return;
    }

    if (intervalRef.current) {
      setIsRunning(true);
      return;
    }

    intervalRef.current = setInterval(tick, delay);
    setIsRunning(true);
  }, [delay, isValidDelay, pauseOnHidden, tick]);

  /* ---------------- STOP ---------------- */
  const stop = useCallback(() => {
    shouldRunRef.current = false;
    clear();
    setIsRunning(false);
  }, [clear]);

  /* ---------------- RUN NOW ---------------- */
  const runNow = useCallback(() => {
    return tick();
  }, [tick]);

  /* ---------------- VISIBILITY HANDLING ---------------- */
  useEffect(() => {
    if (!pauseOnHidden || typeof document === "undefined") return undefined;

    const handleVisibility = () => {
      if (document.hidden) {
        clear();
        setIsRunning(false);
        return;
      }

      if (shouldRunRef.current) {
        start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pauseOnHidden, clear, start]);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    if (!isValidDelay) {
      stop();
      return undefined;
    }

    shouldRunRef.current = true;

    if (immediate) {
      tick();
    }

    start();

    return () => {
      clear();
      setIsRunning(false);
    };
  }, [isValidDelay, immediate, start, stop, clear, tick]);

  return {
    start,
    stop,
    runNow,
    isRunning,
  };
};

export default useSafeInterval;
