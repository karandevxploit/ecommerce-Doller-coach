import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store";
import { useQueryClient } from "@tanstack/react-query";
import logo from "@/assets/logo.png";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { login, isAuthenticated, user } = useAuthStore();

  const mountedRef = useRef(true);
  const adminExistsLoadedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [error, setError] = useState("");
  const [showRegisterHint, setShowRegisterHint] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------------- ALREADY LOGGED IN ---------------- */
  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  /* ---------------- CHECK ADMIN EXISTS ---------------- */
  useEffect(() => {
    if (adminExistsLoadedRef.current) return undefined;

    adminExistsLoadedRef.current = true;
    const controller = new AbortController();

    const checkAdminExists = async () => {
      setCheckingAdmin(true);

      try {
        const res = await api.get("/auth/admin-exists", {
          signal: controller.signal,
        });

        const data = res?.data ?? res;
        const exists =
          data?.data?.exists ??
          data?.exists ??
          data?.adminExists ??
          true;

        if (mountedRef.current) {
          setShowRegisterHint(exists === false);
          if (exists === false) {
            navigate("/admin/register", { replace: true });
          }
        }
      } catch (err) {
        if (
          err?.code === "ERR_CANCELED" ||
          err?.name === "CanceledError" ||
          err?.name === "AbortError"
        ) {
          return;
        }

        if (mountedRef.current) {
          setShowRegisterHint(false);
        }
      } finally {
        if (mountedRef.current) {
          setCheckingAdmin(false);
        }
      }
    };

    checkAdminExists();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  const validate = () => {
    const safeEmail = email.trim();

    if (!safeEmail) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return "Please enter a valid email address.";
    }

    if (!password.trim()) return "Please enter your password.";
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return "";
  };

  const prefetchDashboardData = () => {
    queryClient.prefetchQuery({
      queryKey: ["admin-dashboard-summary"],
      queryFn: async () => {
        const res = await api.get("/admin/stats");
        return res?.data?.data || res?.data || res || {};
      },
      staleTime: 1000 * 60,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const success = await login(
        {
          email: email.trim(),
          password,
          role: "admin",
        },
        "admin-login"
      );

      if (!success) {
        setError("Invalid email or password.");
        return;
      }

      toast.success("Login successful");

      prefetchDashboardData();

      const redirectPath =
        location.state?.from?.pathname ||
        location.state?.from ||
        "/admin/dashboard";

      navigate(
        typeof redirectPath === "string" && redirectPath.startsWith("/admin")
          ? redirectPath
          : "/admin/dashboard",
        { replace: true }
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Login failed. Please try again.";

      setError(msg);
      toast.error(msg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-3xl opacity-50" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.05)] border border-slate-100 p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-xl mb-6 border border-slate-100">
              <img src={logo} alt="Doller Coach" className="h-12 w-12 object-contain" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              Admin Login
            </h1>

            <p className="text-sm text-slate-500 mt-2">
              Sign in to manage your store
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                  role="alert"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-slate-600">
                Email Address
              </label>

              <div className="relative mt-1">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="admin@example.com"
                  aria-label="Email address"
                  autoComplete="email"
                  disabled={loading}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-slate-600">
                Password
              </label>

              <div className="relative mt-1">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Enter your password"
                  aria-label="Password"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm disabled:bg-slate-50"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-slate-900 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Register Hint */}
          {showRegisterHint && (
            <div className="mt-8 text-center text-sm text-slate-500">
              No admin account found?{" "}
              <button
                type="button"
                onClick={() => navigate("/admin/register")}
                className="text-indigo-600 font-medium hover:underline"
              >
                Create one
              </button>
            </div>
          )}

          {/* Back to site */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2"
            >
              <ShoppingBag size={16} />
              Back to Store
            </button>
          </div>

          {checkingAdmin && (
            <p className="mt-4 text-center text-[11px] text-slate-400">
              Checking admin setup...
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
