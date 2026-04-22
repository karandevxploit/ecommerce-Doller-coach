import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store";
import GlobalLoader from "../ui/GlobalLoader";

export default function ProtectedRoute({ children, role }) {
  const {
    isAuthenticated,
    user,
    loading,
    isFetchingUser,
    isInitialized,
  } = useAuthStore();

  const location = useLocation();

  // ================= LOADING STATE =================
  if (!isInitialized || loading || isFetchingUser) {
    return <GlobalLoader isVisible />;
  }

  // ================= NOT LOGGED IN =================
  if (!isAuthenticated) {
    const isAdminRoute = location.pathname.startsWith("/admin");
    const loginPath = isAdminRoute ? "/admin/login" : "/login";

    return (
      <Navigate
        to={loginPath}
        replace
        state={{
          from: location.pathname,
          message: "Please login to continue",
        }}
      />
    );
  }

  // ================= ROLE CHECK =================
  if (role && user?.role !== role) {
    // Admin trying to access user page
    if (user?.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    // User trying to access admin page
    return (
      <Navigate
        to="/"
        replace
        state={{
          message: "You don’t have access to that page",
        }}
      />
    );
  }

  // ================= ALLOWED =================
  return children;
}