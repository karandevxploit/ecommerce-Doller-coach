import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, ShoppingBag } from "lucide-react";
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
        if (mounted) setShowRegisterHint(!res?.exists);
      } catch (err) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const formatError = (err) => {
    const msg = err?.response?.data?.message || "";
    if (msg.includes("Invalid credentials")) return "Incorrect email or password";
    if (msg.includes("User not found")) return "No account found with this email";
    if (msg.includes("password")) return "Password is incorrect";
    return "Login failed. Please try again.";
  };

  const getErrorMessage = (err) => {
    return err?.response?.data?.message || "Something went wrong. Please try again.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const success = await login({ email, password, role: "admin" }, "admin-login");
      
      if (success) {
        toast.success("Login successful 🎉");
        navigate("/admin/dashboard", { replace: true });
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      if (err?.response?.status === 403) {
        const msg = "Wrong portal access. Admin only.";
        setError(msg);
        toast.error(msg);
      } else {
        const msg = getErrorMessage(err);
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
      {/* Premium Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-100 p-8 md:p-10">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="h-14 w-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mb-4 transition-transform hover:scale-105">
              <ShieldCheck size={30} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Welcome Back Admin</h1>
            <p className="text-slate-400 mt-1.5 text-sm font-medium">Login to your admin dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-xs font-bold flex items-center gap-2"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-sm font-semibold text-[#0f172a]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <button type="button" className="text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline transition-all font-bold">
                  Forgot Password?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-12 pr-12 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-sm font-semibold text-[#0f172a]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Super Admin Registration */}
          {showRegisterHint && (
            <div className="mt-8 pt-6 border-t border-slate-50 text-center">
               <button
                type="button"
                onClick={() => navigate("/admin/register")}
                className="text-slate-400 text-[11px] font-bold hover:text-indigo-600 transition-colors flex items-center justify-center gap-1 mx-auto"
               >
                 Don't have an admin account? <span className="text-indigo-600 underline">Create one</span>
               </button>
            </div>
          )}

          {/* Back Navigation */}
          <div className="mt-8 flex justify-center">
              <button 
                onClick={() => navigate("/")}
                className="text-xs text-slate-400 font-bold hover:text-[#0f172a] transition-colors flex items-center gap-2"
              >
                 <ShoppingBag size={14} />
                 Return to storefront
              </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
