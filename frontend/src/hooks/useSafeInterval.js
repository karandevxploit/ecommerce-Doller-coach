import { useEffect, useRef, useCallback } from "react";

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
  { immediate = false } = {}
) => {
  const savedCallback = useRef(callback);
  const intervalRef = useRef(null);
  const isRunning = useRef(false);
  const isExecuting = useRef(false);

  /* ---------------- STORE LATEST CALLBACK ---------------- */
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  /* ---------------- EXECUTION ---------------- */
  const tick = useCallback(async () => {
    if (!savedCallback.current || isExecuting.current) return;

    isExecuting.current = true;

    try {
      await savedCallback.current();
    } catch (err) {
      console.error("[useSafeInterval] Execution error:", err);
    } finally {
      isExecuting.current = false;
    }
  }, []);

  /* ---------------- START ---------------- */
  const start = useCallback(() => {
    if (intervalRef.current || delay === null) return;

    isRunning.current = true;

    intervalRef.current = setInterval(tick, delay);
  }, [delay, tick]);

  /* ---------------- STOP ---------------- */
  const stop = useCallback(() => {
    isRunning.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /* ---------------- VISIBILITY HANDLING ---------------- */
  useEffect(() => {
    if (typeof document === "undefined") return; // SSR safe

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (!intervalRef.current && isRunning.current) {
        start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [start, stop]);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    if (delay === null) return;

    if (immediate) tick();
    start();

    return () => stop();
  }, [delay, immediate, start, stop, tick]);

  return {
    start,
    stop,
    isRunning: isRunning.current
  };
};