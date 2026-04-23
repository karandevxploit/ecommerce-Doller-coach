import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";
import toast from "react-hot-toast";

/**
 * useActionGuard Hook
 * 
 * Protects sensitive actions (Add to Cart, Wishlist, etc.)
 * by redirecting to login and resuming after success.
 */
export const useActionGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  const guardAction = useCallback((type, payload, callback) => {
    if (isAuthenticated) {
      // Just run the action if already logged in
      return callback();
    }

    // Save intended action for resumption
    const pendingAction = {
      type,
      payload,
      path: location.pathname
    };

    localStorage.setItem("pendingAction", JSON.stringify(pendingAction));

    // Notify and redirect
    toast("Please login to continue", { icon: "🔒" });
    navigate("/login", { state: { from: location.pathname } });

    return false;
  }, [isAuthenticated, navigate, location]);

  return { guardAction };
};
