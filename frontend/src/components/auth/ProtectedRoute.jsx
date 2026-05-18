import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store";
import GlobalLoader from "../ui/GlobalLoader";

const normalizeRole = (role) => {
  return String(role || "").trim().toLowerCase();
};

export default function ProtectedRoute({ children, role }) {
  const {
    isAuthenticated,
    user,
    loading,
    isFetchingUser,
    isInitialized,
  } = useAuthStore();

  const location = useLocation();

  if (!isInitialized || loading || isFetchingUser) {
    return <GlobalLoader isVisible />;
  }

  if (!isAuthenticated) {
    const isAdminRoute = location.pathname.startsWith("/admin");
    const loginPath = isAdminRoute ? "/admin/login" : "/login";

    if (location.pathname === loginPath) {
      return children || null;
    }

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

  const requiredRole = normalizeRole(role);
  const currentRole = normalizeRole(user?.role);
  const isAdminRoute = location.pathname.startsWith("/admin");

  if (requiredRole && currentRole !== requiredRole) {
    if (requiredRole === "admin" || isAdminRoute) {
      return (
        <Navigate
          to="/admin/login"
          replace
          state={{
            from: location.pathname,
            message: "Please login as admin to continue",
          }}
        />
      );
    }

    if (currentRole === "admin" && requiredRole !== "admin") {
      return children || null;
    }

    if (currentRole === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    return (
      <Navigate
        to="/"
        replace
        state={{
          from: location.pathname,
          message: "You don't have access to that page",
        }}
      />
    );
  }

  return children || null;
}
