import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import {
  ShieldCheck,
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    secret: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [adminExists, setAdminExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.get("/auth/admin-exists");
        if (mounted) setAdminExists(Boolean(res?.exists));
      } catch {
        // silent
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return "Please enter your full name.";
    if (!form.email.trim()) return "Please enter your email.";
    if (!/\S+@\S+\.\S+/.test(form.email))
      return "Please enter a valid email address.";
    if (!form.password) return "Please create a password.";
    if (form.password.length < 6)
      return "Password must be at least 6 characters.";
    if (!form.secret.trim()) return "Admin secret key is required.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        ...form,
        provider: "email",
      });

      setSuccess(true);
      toast.success("Account created successfully");

      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 2000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create account. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
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
          <div className="h-14 w-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck size={28} />
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
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-600">
              Full Name
            </label>
            <div className="relative mt-1">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                placeholder="John Doe"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-slate-600">
              Email
            </label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                placeholder="admin@example.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-slate-600">
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
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
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showSecret ? "text" : "password"}
                value={form.secret}
                onChange={(e) => handleChange("secret", e.target.value)}
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-sm"
                placeholder="Enter secret key"
              />
              <button
                type="button"
                onClick={() => setShowSecret((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || adminExists}
            className="w-full h-12 bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading
              ? "Creating account..."
              : adminExists
                ? "Admin already exists"
                : "Create Account"}
            {!loading && !adminExists && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
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