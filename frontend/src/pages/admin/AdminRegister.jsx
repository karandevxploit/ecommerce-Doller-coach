import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../api/client";
import { ShieldCheck, User as UserIcon, Mail, Lock, Key, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
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
      } catch (err) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const formatError = (err) => {
    const raw = String(err).toLowerCase();
    if (raw.includes("email")) return "Invalid email or account already exists";
    if (raw.includes("password")) return "Password must be at least 6 characters";
    if (raw.includes("secret")) return "Invalid admin secret key";
    if (raw.includes("validation failed")) return "Something went wrong while creating your account. Please try again.";
    return "Something went wrong. Please try again.";
  };

  const validateEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (adminExists) {
      setError("An admin account already exists. Only one root admin is allowed.");
      return;
    }

    if (!name || !email || !password || !secret) {
      setError("All fields are required to create an account.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/admin-register", { 
        name, 
        email, 
        password, 
        secret, 
        provider: "email" 
      });
      
      setSuccess(true);
      toast.success("Admin account created successfully 🎉");
      
      setTimeout(() => {
        navigate("/admin/login", { replace: true });
      }, 2000);
      
    } catch (err) {
      const msg = err?.response?.data?.message || "Registration failed";
      const friendlyMsg = formatError(msg);
      setError(friendlyMsg);
      toast.error(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-10 shadow-2xl text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 size={48} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-[#0f172a]">Success!</h2>
            <p className="text-gray-500 font-medium">Admin account created successfully 🎉</p>
          </div>
          <p className="text-xs text-gray-400 animate-pulse">Redirecting to login interface...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50" />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] p-8 md:p-10 shadow-xl border border-gray-100 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <ShieldCheck size={30} />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Create Admin Account</h1>
          <p className="text-sm text-gray-400 font-medium mt-1">Set up your secure administrative access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 ml-1">Full Name</label>
            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none text-[#0f172a] font-semibold text-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none text-[#0f172a] font-semibold text-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-gray-700">Password</label>
              <span className="text-[10px] font-bold text-gray-400">Min. 6 chars</span>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none text-[#0f172a] font-semibold text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 ml-1">Admin Secret Key</label>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter system secret key"
                className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none text-[#0f172a] font-semibold text-sm transition-all text-indigo-600"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs font-bold text-red-600 leading-normal">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || adminExists}
            className="w-full h-14 bg-[#0f172a] text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-gray-200 hover:bg-gray-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
          >
            {adminExists ? "Registration Locked" : loading ? "Creating..." : "Create Admin Account"}
            {!loading && !adminExists && <ArrowRight size={18} />}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-gray-50 text-center">
          <button
            type="button"
            onClick={() => navigate("/admin/login")}
            className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft size={14} />
            Already have an account? Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
