import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  // 🔄 Loading State (Premium)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ffffff] text-white">

        {/* Background Glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-transparent  rounded-full" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-transparent  rounded-full" />
        </div>

        <div className="flex flex-col items-center gap-3">

          {/* Loader */}
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
          </div>

          <p className="text-sm text-white/60">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  // ❌ Not Authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ✅ Authorized
  return children ? children : <Outlet />;
}