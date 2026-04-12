import { useEffect, useRef } from "react";

/**
 * useSafeInterval Hook
 * A production-grade replacement for setInterval that:
 * 1. Automatically clears on unmount
 * 2. Pauses execution when the browser tab is hidden (Page Visibility API)
 * 3. Prevents overlapping executions if the callback is async
 */
export const useSafeInterval = (callback, delay) => {
  const savedCallback = useRef(callback);
  const intervalId = useRef(null);
  const isExecuting = useRef(false);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = async () => {
      // 1. Skip if already executing (Prevents queue backup)
      if (savedCallback.current && !isExecuting.current) {
        isExecuting.current = true;
        try {
          await savedCallback.current();
        } finally {
          isExecuting.current = false;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId.current) {
          clearInterval(intervalId.current);
          intervalId.current = null;
        }
      } else {
        if (!intervalId.current) {
          intervalId.current = setInterval(tick, delay);
        }
      }
    };

    // Initial setup
    if (!document.hidden) {
      intervalId.current = setInterval(tick, delay);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId.current) clearInterval(intervalId.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [delay]);
};
