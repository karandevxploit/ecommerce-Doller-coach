import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../api/client";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "536224738397-ht6q3v710gdjb0a9ulr9okjsuv9sh7sg.apps.googleusercontent.com";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
};

const getErrorMessage = (err, fallback) => {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

export default function AuthSystem() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    login,
    setSession: storeSetSession,
  } = useAuthStore();

  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [otp, setOtp] = useState("");

  const googleButtonRef = useRef(null);
  const googleRenderedRef = useRef(false);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetSensitiveFields = useCallback(() => {
    setForm((prev) => ({ ...prev, password: "" }));
    setOtp("");
  }, []);

  const handleClose = useCallback(() => {
    resetSensitiveFields();
    closeAuthModal();
  }, [closeAuthModal, resetSensitiveFields]);

  const setSession = useCallback(
    (data) => {
      const success = storeSetSession(data);

      if (!success) {
        toast.error("Session setup failed");
        return false;
      }

      if (remember && typeof localStorage !== "undefined") {
        const user = data?.user || data?.data?.user || data;
        localStorage.setItem("user", JSON.stringify(user));
      }

      toast.success("Login successful");
      handleClose();
      return true;
    },
    [storeSetSession, remember, handleClose]
  );

  useEffect(() => {
    if (!isAuthModalOpen) return;

    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("user") : null;
    if (saved) {
      closeAuthModal();
    }
  }, [isAuthModalOpen, closeAuthModal]);

  useEffect(() => {
    if (!isAuthModalOpen || !googleButtonRef.current || googleRenderedRef.current) return;

    const google = window.google;

    if (!google?.accounts?.id) {
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        if (!response?.credential || loading) return;

        try {
          setLoading(true);
          const success = await login({ token: response.credential }, "google");

          if (success) {
            toast.success("Google login successful");
            handleClose();
          }
        } catch (err) {
          toast.error(getErrorMessage(err, "Google auth failed"));
        } finally {
          setLoading(false);
        }
      },
    });

    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      width: "250",
      text: "continue_with",
      shape: "rectangular",
    });

    googleRenderedRef.current = true;
  }, [isAuthModalOpen, login, handleClose, loading]);

  useEffect(() => {
    if (!isAuthModalOpen) {
      googleRenderedRef.current = false;
    }
  }, [isAuthModalOpen]);

  const validateEmailPassword = () => {
    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      toast.error("Please fill all fields");
      return false;
    }

    if (!isValidEmail(email)) {
      toast.error("Invalid email address");
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (loading || !validateEmailPassword()) return;

    setLoading(true);

    try {
      const success = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (success) {
        toast.success("Login successful");
        handleClose();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (loading) return;

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!name || !email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Invalid email address");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", { name, email, password });
      toast.success("Account created successfully");
      setMode("login");
      setForm((prev) => ({ ...prev, name: "", password: "" }));
    } catch (err) {
      toast.error(getErrorMessage(err, "Signup failed. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (loading) return;

    const email = form.email.trim().toLowerCase();

    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Invalid email address");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/send-otp", { email });
      toast.success("OTP sent to your email");
      setOtp("");
      setMode("otp");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (loading) return;

    const cleanOtp = otp.trim();
    const email = form.email.trim().toLowerCase();

    if (!cleanOtp) {
      toast.error("Enter OTP");
      return;
    }

    if (!email || !isValidEmail(email)) {
      toast.error("Invalid email address");
      setMode("login");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", {
        email,
        otp: cleanOtp,
      });

      setSession(res?.data || res);
    } catch (err) {
      toast.error(getErrorMessage(err, "Invalid OTP"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (loading) return;

    const email = form.email.trim().toLowerCase();

    if (!email) {
      toast.error("Enter your email");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Invalid email address");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", { email });
      toast.success("Password reset link sent");
      setMode("login");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to send reset link"));
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryAction = () => {
    if (mode === "login") return handleLogin();
    if (mode === "signup") return handleSignup();
    if (mode === "forgot") return handleForgot();
    return verifyOtp();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handlePrimaryAction();
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setOtp("");
  };

  if (!isAuthModalOpen) return null;

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
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-black transition flex items-center justify-center p-2"
        >
          <X size={20} />
        </button>

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

        <form onSubmit={handleSubmit} className="space-y-4">
          {(mode === "login" || mode === "signup") && (
            <>
              {mode === "signup" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-900">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-900">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-900">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
                />
              </div>
            </>
          )}

          {mode === "otp" && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-900">
                One-Time Password
              </label>
              <input
                placeholder="Ex. 123456"
                value={otp}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full text-center text-lg tracking-[0.5em] font-medium bg-transparent border-b border-slate-300 py-4 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
              />
            </div>
          )}

          {mode === "forgot" && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-900">
                Email Address
              </label>
              <input
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full text-sm bg-transparent border-b border-slate-300 py-3 text-slate-900 focus:outline-none focus:border-black transition-colors rounded-none px-0"
              />
            </div>
          )}

          {(mode === "login" || mode === "signup") && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={() => setRemember((prev) => !prev)}
                className="w-4 h-4 accent-black cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-xs text-slate-500 uppercase tracking-widest cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 mt-2 text-xs font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Continue"}
          </button>

          <div className="pt-2">
            <div className="flex items-center gap-4 py-2">
              <hr className="flex-1 border-slate-200" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                Or
              </span>
              <hr className="flex-1 border-slate-200" />
            </div>

            <div className="flex justify-center mt-2">
              <div ref={googleButtonRef} id="googleBtn" />
            </div>

            {!window.google?.accounts?.id && (
              <p className="text-center text-[10px] text-slate-400 mt-2 uppercase tracking-widest">
                Google sign in unavailable
              </p>
            )}
          </div>

          <div className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 pt-4 space-y-4">
            {mode === "login" && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="hover:text-black transition"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="hover:text-black transition"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={loading}
                  className="hover:text-black transition decoration-1 underline-offset-4 disabled:opacity-50"
                >
                  Login with OTP
                </button>
              </div>
            )}

            {mode === "signup" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="hover:text-black transition"
              >
                Already have an account? Sign in
              </button>
            )}

            {(mode === "otp" || mode === "forgot") && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="hover:text-black transition"
              >
                Return to Sign in
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
