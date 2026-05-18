import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";
import toast from "react-hot-toast";

/**
 * useActionGuard Hook
 *
 * Protects sensitive actions (Add to Cart, Wishlist, etc.)
 * by redirecting/opening login and resuming after success.
 */
export const useActionGuard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, openAuthModal } = useAuthStore();

  const guardAction = useCallback(
    async (type, payload = {}, callback) => {
      if (isAuthenticated) {
        if (typeof callback === "function") {
          return callback();
        }

        return true;
      }

      const pendingAction = {
        type,
        payload,
        path: `${location.pathname}${location.search || ""}`,
        createdAt: Date.now(),
      };

      try {
        localStorage.setItem("pendingAction", JSON.stringify(pendingAction));
      } catch {
        // Ignore storage errors. Login guard should still work.
      }

      toast("Please login to continue", { icon: "🔒" });

      if (typeof openAuthModal === "function") {
        openAuthModal();
      } else {
        navigate("/login", {
          replace: false,
          state: {
            from: location,
            pendingAction,
          },
        });
      }

      return false;
    },
    [isAuthenticated, location, navigate, openAuthModal]
  );

  return { guardAction };
};

export default useActionGuard;
