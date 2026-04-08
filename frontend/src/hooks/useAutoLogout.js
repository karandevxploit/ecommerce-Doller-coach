import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * useAutoLogout hook
 * @param {number} timeout - Inactivity period in milliseconds (default 10 minutes)
 */
export default function useAutoLogout(timeout = 7200000) {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const logout = () => {
    console.warn("[useAutoLogout] Triggering inactivity logout...");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    // Also clear general auth if needed, but the requirement was specifically admin security
    localStorage.removeItem("token"); 
    localStorage.removeItem("auth-storage");
    
    navigate("/admin/login");
    window.location.reload(); // Hard reset to clear stores/state
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, timeout);
  };

  useEffect(() => {
    // Initial timer
    resetTimer();

    // Event listeners for activity tracking
    const events = ["mousemove", "keypress", "click", "scroll", "touchstart"];
    
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [timeout]);

  return { resetTimer };
}
