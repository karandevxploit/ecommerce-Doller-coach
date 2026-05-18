import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../api/client";

import { useForm } from "../hooks/useForm";
import { loginValidator } from "../utils/validation";
import { useAuthStore, useCartStore, useWishlistStore } from "../store";
import { resumePendingAction } from "../utils/authActions";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const mountedRef = useRef(true);
  const googleRenderedRef = useRef(false);

  const { login, setSession } = useAuthStore();
  const cartStore = useCartStore();
  const wishlistStore = useWishlistStore();

  const [showPassword, setShowPassword] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
  } = useForm({ email: "", password: "" }, loginValidator);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const redirectUser = useCallback(async () => {
    const resumed = await resumePendingAction({
      cartStore,
      wishlistStore,
      navigate,
    });

    if (resumed) return;

    const user = useAuthStore.getState().user;

    const fromState = location.state?.from;
    const from =
      typeof fromState === "string"
        ? fromState
        : fromState?.pathname || (user?.role === "admin" ? "/admin/dashboard" : "/");

    navigate(from || "/", { replace: true });
  }, [cartStore, wishlistStore, navigate, location.state]);

  /* ---------------- GOOGLE LOGIN ---------------- */
  useEffect(() => {
    const initGoogle = () => {
      if (googleRenderedRef.current) return;
      if (!window.google?.accounts?.id) return;

      const btn = document.getElementById("googleBtnPage");
      if (!btn) return;

      googleRenderedRef.current = true;

      window.google.accounts.id.initialize({
        client_id:
          "536224738397-ht6q3v710gdjb0a9ulr9okjsuv9sh7sg.apps.googleusercontent.com",
        callback: async (response) => {
          try {
            const success = await login(
              { token: response.credential },
              "google"
            );

            if (success !== false) {
              toast.success("Login successful");
              await redirectUser();
            }
          } catch (err) {
            toast.error(
              err?.response?.data?.message || "Google login failed"
            );
          }
        },
      });

      window.google.accounts.id.renderButton(btn, {
        theme: "outline",
        size: "large",
        width: "320",
      });
    };

    const timer = setTimeout(initGoogle, 500);

    return () => clearTimeout(timer);
  }, [login, redirectUser]);

  /* ---------------- EMAIL LOGIN ---------------- */
  const handleEmailLogin = async (data) => {
    try {
      const payload = {
        email: data.email?.trim().toLowerCase(),
        password: data.password,
      };

      const success = await login(payload, "login");

      if (success !== false) {
        toast.success("Login successful");
        await redirectUser();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Invalid email or password"
      );
    }
  };

  /* ---------------- OTP LOGIN ---------------- */
  const sendOtp = async () => {
    const email = values.email?.trim().toLowerCase();

    if (!email) {
      return toast.error("Enter your email first");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error("Enter a valid email address");
    }

    if (otpLoading) return;

    try {
      setOtpLoading(true);

      await api.post("/auth/request-login-otp", {
        email,
        purpose: "login",
      });

      toast.success("OTP sent to your email");
      setOtpMode(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      if (mountedRef.current) {
        setOtpLoading(false);
      }
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();

    const email = values.email?.trim().toLowerCase();

    if (!email) {
      return toast.error("Enter your email first");
    }

    if (otp.length !== 6) {
      return toast.error("Enter a valid 6-digit OTP");
    }

    if (otpLoading) return;

    try {
      setOtpLoading(true);

      const res = await api.post("/auth/verify-otp", {
        email,
        otp,
        purpose: "login",
      });

      const data = res?.data ?? res;
      const success = setSession?.(data);

      if (success === false) {
        throw new Error("Unable to start session");
      }

      toast.success("Login successful");
      await redirectUser();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Invalid OTP");
    } finally {
      if (mountedRef.current) {
        setOtpLoading(false);
      }
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center px-4 bg-gray-50"
    >
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold">
            {otpMode ? "Enter OTP" : "Login"}
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            {otpMode
              ? "Check your email for the code"
              : "Login to your account"}
          </p>
        </div>

        {!otpMode ? (
          <form
            onSubmit={(e) => handleSubmit(e, handleEmailLogin)}
            className="space-y-4"
          >
            {/* Email */}
            <div>
              <label className="text-sm text-gray-600">
                Email
              </label>

              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                <input
                  type="email"
                  name="email"
                  value={values.email}
                  onChange={handleChange}
                  autoComplete="email"
                  className="w-full h-12 pl-10 pr-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>

              {errors.email && (
                <p className="text-xs text-red-500">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm text-gray-600">
                Password
              </label>

              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  className="w-full h-12 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {errors.password && (
                <p className="text-xs text-red-500">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-black text-white rounded-lg disabled:opacity-60"
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              className="w-full text-center text-xl tracking-widest border rounded-lg py-3"
              placeholder="Enter OTP"
            />

            <button
              type="submit"
              disabled={otpLoading}
              className="w-full h-12 bg-black text-white rounded-lg disabled:opacity-60"
            >
              {otpLoading ? "Verifying..." : "Verify & Login"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOtpMode(false);
                setOtp("");
              }}
              className="text-sm text-gray-500 w-full"
            >
              Back to password login
            </button>
          </form>
        )}

        {/* OTP BUTTON */}
        {!otpMode && (
          <button
            type="button"
            onClick={sendOtp}
            disabled={otpLoading}
            className="w-full mt-4 border rounded-lg py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            <KeyRound size={16} />
            {otpLoading ? "Sending OTP..." : "Login with OTP"}
          </button>
        )}

        {/* Google */}
        <div className="mt-6">
          <div className="text-center text-xs text-gray-400 mb-3">
            OR
          </div>

          <div className="flex justify-center">
            <div id="googleBtnPage" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <Link to="/forgot-password" className="block">
            Forgot password?
          </Link>

          <p className="mt-2">
            Don’t have an account?{" "}
            <Link to="/register" className="text-black font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
