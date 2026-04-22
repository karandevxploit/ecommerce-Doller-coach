import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import {
  ShieldCheck,
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

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegisterHint, setShowRegisterHint] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.get("/auth/admin-exists");
        // Structure check: res.data.data.exists
        const exists = res?.data?.data?.exists ?? res?.data?.exists ?? true;
        if (mounted) {
          setShowRegisterHint(!exists);
        }
      } catch {
        // silent fallback
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const validate = () => {
    if (!email.trim()) return "Please enter your email address.";
    if (!/\S+@\S+\.\S+/.test(email))
      return "Please enter a valid email address.";
    if (!password.trim()) return "Please enter your password.";
    if (password.length < 6)
      return "Password must be at least 6 characters.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // 🔄 Reset error state

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      console.log("[ADMIN_LOGIN] Requesting login...");
      const success = await login(
        { email, password, role: "admin" },
        "admin-login"
      );

      if (success) {
        toast.success("Login successful");
        navigate("/admin/dashboard");
      } else {
        setError("Invalid email or password.");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Login failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
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
            <div className="h-16 w-16 bg-slate-950 text-white rounded-2xl flex items-center justify-center shadow-xl mb-6">
              <ShieldCheck size={30} />
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  aria-label="Email address"
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
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
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  aria-label="Password"
                  className="w-full h-12 pl-11 pr-11 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
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
              onClick={() => navigate("/")}
              className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2"
            >
              <ShoppingBag size={16} />
              Back to Store
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}