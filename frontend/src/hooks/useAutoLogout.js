import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * useAutoLogout
 * Handles inactivity logout with performance optimization + multi-tab sync
 */
export default function useAutoLogout({
  timeout = 2 * 60 * 60 * 1000, // 2 hours
  redirectTo = "/admin/login",
  storageKeys = ["adminToken", "adminUser", "token", "auth-storage"]
} = {}) {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  /* ---------------- LOGOUT ---------------- */
  const logout = useCallback(() => {
    storageKeys.forEach((key) => localStorage.removeItem(key));

    // Notify other tabs
    localStorage.setItem("logout-event", Date.now());

    navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo, storageKeys]);

  /* ---------------- RESET TIMER (THROTTLED) ---------------- */
  const resetTimer = useCallback(() => {
    const now = Date.now();

    // throttle: ignore too frequent events
    if (now - lastActivityRef.current < 1000) return;

    lastActivityRef.current = now;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, timeout);
  }, [logout, timeout]);

  /* ---------------- EFFECT ---------------- */
  useEffect(() => {
    resetTimer();

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    /* ---------------- TAB SYNC ---------------- */
    const handleStorage = (e) => {
      if (e.key === "logout-event") {
        navigate(redirectTo, { replace: true });
      }
    };

    window.addEventListener("storage", handleStorage);

    /* ---------------- VISIBILITY CHANGE ---------------- */
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);

      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );

      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [resetTimer, navigate, redirectTo]);

  return { resetTimer };
}