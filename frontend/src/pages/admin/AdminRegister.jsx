import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import {
  User as UserIcon,
  Mail,
  Lock,
  Key,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

export default function AdminRegister() {
  const navigate = useNavigate();

  const mountedRef = useRef(true);
  const redirectTimerRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    secret: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [adminExists, setAdminExists] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
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
          false;

        if (mountedRef.current) {
          setAdminExists(Boolean(exists));
          if (exists) {
            navigate("/admin/login", { replace: true });
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
          setAdminExists(false);
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

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (error) {
      setError("");
    }
  };

  const validate = () => {
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name) return "Please enter your full name.";
    if (!email) return "Please enter your email.";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address.";
    }

    if (!form.password) return "Please create a password.";

    if (form.password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (!form.secret.trim()) return "Admin secret key is required.";

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || checkingAdmin) return;

    setError("");

    if (adminExists) {
      setError("Admin account already exists. Please login.");
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/admin-register", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        adminSecret: form.secret.trim(),
      });

      if (!mountedRef.current) return;

      setSuccess(true);
      toast.success("Account created successfully");

      redirectTimerRef.current = setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 1800);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create account. Please try again.";

      if (mountedRef.current) {
        setError(msg);
      }

      toast.error(msg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-10 shadow-xl text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
              <CheckCircle2 size={44} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            Account Created
          </h2>

          <p className="text-slate-500 text-sm">
            Your admin account is ready. Redirecting to login...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center mb-4 border border-slate-100 shadow-lg">
            <img src={logo} alt="Doller Coach" className="h-10 w-10 object-contain" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Create Admin Account
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Set up access to your admin dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex gap-2"
                role="alert"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-600">
              Full Name
            </label>

            <div className="relative mt-1">
              <UserIcon
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm disabled:bg-slate-50"
                placeholder="John Doe"
                autoComplete="name"
                disabled={loading || checkingAdmin}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-slate-600">
              Email
            </label>

            <div className="relative mt-1">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm disabled:bg-slate-50"
                placeholder="admin@example.com"
                autoComplete="email"
                disabled={loading || checkingAdmin}
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
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm disabled:bg-slate-50"
                placeholder="Enter password"
                autoComplete="new-password"
                disabled={loading || checkingAdmin}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 disabled:opacity-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading || checkingAdmin}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Secret */}
          <div>
            <label className="text-sm font-medium text-slate-600">
              Admin Secret Key
            </label>

            <div className="relative mt-1">
              <Key
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type={showSecret ? "text" : "password"}
                value={form.secret}
                onChange={(e) => handleChange("secret", e.target.value)}
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm disabled:bg-slate-50"
                placeholder="Enter secret key"
                autoComplete="off"
                disabled={loading || checkingAdmin}
              />

              <button
                type="button"
                onClick={() => setShowSecret((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 disabled:opacity-50"
                aria-label={showSecret ? "Hide secret key" : "Show secret key"}
                disabled={loading || checkingAdmin}
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || checkingAdmin || adminExists}
            className="w-full h-12 bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Creating account...
              </>
            ) : checkingAdmin ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Checking setup...
              </>
            ) : adminExists ? (
              "Admin already exists"
            ) : (
              <>
                Create Account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate("/admin/login")}
            className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2 justify-center"
          >
            <ArrowLeft size={16} />
            Back to login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
