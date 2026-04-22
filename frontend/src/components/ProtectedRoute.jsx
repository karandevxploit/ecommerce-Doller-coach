import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";

/**
 * ProtectedRoute
 * Guards private routes with proper UX + state handling
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-white"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">

          {/* Spinner */}
          <div className="h-10 w-10 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />

          <p className="text-sm text-slate-500">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- NOT AUTHENTICATED ---------------- */
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }} // full redirect support
      />
    );
  }

  /* ---------------- AUTHORIZED ---------------- */
  return children || <Outlet />;
}