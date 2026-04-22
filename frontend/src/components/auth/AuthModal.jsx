import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store";
import { GoogleLogin } from "@react-oauth/google";

/**
 * COMPLETE AUTH SYSTEM (ALL-IN-ONE modal layout)
 */

export default function AuthSystem() {
  const navigate = useNavigate();
  const { isAuthModalOpen, closeAuthModal, login } = useAuthStore();

  const [mode, setMode] = useState("login"); // login | signup | forgot | otp
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [otp, setOtp] = useState("");

  // ================= SESSION RESTORE =================
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      closeAuthModal();
    }
  }, [closeAuthModal]);

  const setSession = (data) => {
    if (remember) {
      localStorage.setItem("user", JSON.stringify(data.user || data));
    }
    toast.success("Login successful");
    closeAuthModal();
    navigate(0); // Refresh to update user state globally if not using store sync
  };

  // ================= LOGIN =================
  const handleLogin = async () => {
    if (!form.email || !form.password) {
      return toast.error("Please fill all fields");
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      // Wait, api might return the object directly depending on interceptor
      const data = res?.data || res;
      setSession(data);
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // ================= SIGNUP =================
  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password) {
      return toast.error("Please fill all fields");
    }

    setLoading(true);
    try {
      await api.post("/auth/register", form);
      toast.success("Account created successfully");
      setMode("login");
    } catch {
      toast.error("Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ================= SEND OTP =================
  const sendOtp = async () => {
    if (!form.email) {
      return toast.error("Please enter your email");
    }

    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email: form.email });
      toast.success("OTP sent to your email");
      setMode("otp");
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // ================= VERIFY OTP =================
  const verifyOtp = async () => {
    if (!otp) return toast.error("Enter OTP");

    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", {
        email: form.email,
        otp,
      });
      const data = res?.data || res;
      setSession(data);
    } catch {
      toast.error("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // ================= FORGOT PASSWORD =================
  const handleForgot = async () => {
    if (!form.email) {
      return toast.error("Enter your email");
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email: form.email });
      toast.success("Password reset link sent");
      setMode("login");
    } catch {
      toast.error("Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeAuthModal();
    }
  };

  if (!isAuthModalOpen) return null;

  // ================= UI =================
  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white w-full max-w-md p-8 shadow-2xl rounded-sm max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        {/* CLOSE BUTTON */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-black transition flex items-center justify-center p-2"
        >
          <X size={20} />
        </button>

        {/* TITLE */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase tracking-widest text-slate-900 mb-2">
            {mode === "login" && "Welcome Back"}
            {mode === "signup" && "Create Account"}
            {mode === "forgot" && "Reset Password"}
            {mode === "otp" && "Enter OTP"}
          </h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            {mode === "login" && "Sign in to access your luxury experience"}
            {mode === "signup" && "Join our exclusive community"}
            {mode === "forgot" && "We'll send you a reset link"}
            {mode === "otp" && "Check your email for the code"}
          </p>
        </div>

        {/* FORM GRID */}
        <div className="space-y-4">
          {(mode === "login" || mode === "signup") && (
            <>
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-900">Full Name</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-900">Email Address</label>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-900">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
                />
              </div>
            </>
          )}

          {mode === "otp" && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-900">One-Time Password</label>
              <input
                placeholder="Ex. 123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-center text-lg tracking-[0.5em] font-medium bg-transparent border-b border-slate-300 py-4 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
              />
            </div>
          )}

          {mode === "forgot" && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-900">Email Address</label>
              <input
                type="email"
                placeholder="jane@example.com"
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
              />
            </div>
          )}

          {/* REMEMBER */}
          {(mode === "login" || mode === "signup") && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={() => setRemember(!remember)}
                className="w-4 h-4 accent-black cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                Remember me
              </label>
            </div>
          )}

          {/* BUTTON */}
          <button
            onClick={
              mode === "login"
                ? handleLogin
                : mode === "signup"
                  ? handleSignup
                  : mode === "forgot"
                    ? handleForgot
                    : verifyOtp
            }
            disabled={loading}
            className="w-full bg-black text-white py-4 mt-2 text-xs font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Continue"}
          </button>

          {/* GOOGLE DIRECT SIGN IN */}
          <div className="pt-2">
            <div className="flex items-center gap-4 py-2">
              <hr className="flex-1 border-slate-200" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Or</span>
              <hr className="flex-1 border-slate-200" />
            </div>

            <div className="flex justify-center mt-2">
              <GoogleLogin
                onSuccess={async (res) => {
                  try {
                    setLoading(true);
                    await login(
                      { credential: res.credential },
                      "google"
                    );
                    toast.success("Google login successful");
                    closeAuthModal();
                    navigate(0); // refresh the page to sync
                  } catch {
                    toast.error("Google login failed");
                  } finally {
                    setLoading(false);
                  }
                }}
                onError={() => toast.error("Google login failed")}
                theme="outline"
                size="large"
                shape="rectangular"
                width="100%"
              />
            </div>
          </div>

          {/* LINKS */}
          <div className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 pt-4 space-y-4">
            {mode === "login" && (
              <div className="flex flex-col gap-3">
                <button onClick={() => setMode("forgot")} className="hover:text-black transition">
                  Forgot password?
                </button>
                <button onClick={() => setMode("signup")} className="hover:text-black transition">
                  Create account
                </button>
                <button onClick={sendOtp} className="hover:text-black transition decoration-1 underline-offset-4">
                  Login with OTP
                </button>
              </div>
            )}

            {mode === "signup" && (
              <button onClick={() => setMode("login")} className="hover:text-black transition">
                Already have an account? Sign in
              </button>
            )}

            {(mode === "otp" || mode === "forgot") && (
              <button onClick={() => setMode("login")} className="hover:text-black transition">
                Return to Sign in
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}