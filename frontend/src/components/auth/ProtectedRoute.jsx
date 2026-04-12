import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store";
import GlobalLoader from "../ui/GlobalLoader";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <GlobalLoader isVisible={true} />;
  }

  if (!isAuthenticated) {
    // Save the attempted location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
