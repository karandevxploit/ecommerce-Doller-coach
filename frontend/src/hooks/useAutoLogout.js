import { useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/**
 * useAutoLogout
 * Handles inactivity logout with performance optimization + multi-tab sync
 */
export default function useAutoLogout({
  timeout = 2 * 60 * 60 * 1000, // 2 hours
  redirectTo = "/admin/login",
  storageKeys = ["adminToken", "adminUser", "token", "auth-storage"],
} = {}) {
  const navigate = useNavigate();

  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const safeStorageKeys = useMemo(() => {
    return Array.isArray(storageKeys)
      ? storageKeys.filter(Boolean)
      : ["adminToken", "adminUser", "token", "auth-storage"];
  }, [storageKeys]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /* ---------------- LOGOUT ---------------- */
  const logout = useCallback(() => {
    clearTimer();

    try {
      safeStorageKeys.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem("logout-event", String(Date.now()));
    } catch {
      // Storage can fail in private mode. Redirect should still happen.
    }

    navigate(redirectTo, { replace: true });
  }, [clearTimer, navigate, redirectTo, safeStorageKeys]);

  /* ---------------- RESET TIMER (THROTTLED) ---------------- */
  const resetTimer = useCallback(
    (force = false) => {
      const now = Date.now();

      // throttle: ignore too frequent events
      if (!force && now - lastActivityRef.current < 1000) return;

      lastActivityRef.current = now;

      try {
        localStorage.setItem("last-activity", String(now));
      } catch {
        // Ignore storage errors.
      }

      clearTimer();
      timerRef.current = setTimeout(logout, timeout);
    },
    [clearTimer, logout, timeout]
  );

  const checkExpired = useCallback(() => {
    const now = Date.now();

    let lastActivity = lastActivityRef.current;

    try {
      const stored = Number(localStorage.getItem("last-activity"));
      if (Number.isFinite(stored) && stored > 0) {
        lastActivity = stored;
      }
    } catch {
      // Ignore storage errors.
    }

    if (now - lastActivity >= timeout) {
      logout();
      return true;
    }

    return false;
  }, [logout, timeout]);

  /* ---------------- EFFECT ---------------- */
  useEffect(() => {
    if (!Number.isFinite(timeout) || timeout <= 0) return undefined;

    resetTimer(true);

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    /* ---------------- TAB SYNC ---------------- */
    const handleStorage = (event) => {
      if (event.key === "logout-event") {
        clearTimer();
        navigate(redirectTo, { replace: true });
      }

      if (event.key === "last-activity") {
        resetTimer(true);
      }
    };

    window.addEventListener("storage", handleStorage);

    /* ---------------- VISIBILITY CHANGE ---------------- */
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!checkExpired()) {
          resetTimer(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimer();

      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );

      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    timeout,
    resetTimer,
    clearTimer,
    checkExpired,
    navigate,
    redirectTo,
  ]);

  return { resetTimer, logout };
}
