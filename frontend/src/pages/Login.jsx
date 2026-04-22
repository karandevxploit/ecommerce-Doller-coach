import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { useAuthStore } from "../store";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { GoogleLogin } from "@react-oauth/google";

import { useForm } from "../hooks/useForm";
import { loginValidator } from "../utils/validation";
import { useAuthStore, useCartStore, useWishlistStore } from "../store";
import { resumePendingAction } from "../utils/authActions";

export default function Login() {
  const navigate = useNavigate();
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

  const redirectUser = async () => {
    const resumed = await resumePendingAction({ cartStore, wishlistStore, navigate });
    if (resumed) return;

    const user = useAuthStore.getState().user;
    navigate(user?.role === "admin" ? "/admin/dashboard" : "/");
  };

  /* ---------------- EMAIL LOGIN ---------------- */
  const handleEmailLogin = async (data) => {
    try {
      const success = await login(
        { ...data, provider: "email" },
        "login"
      );

      if (success !== false) {
        toast.success("Login successful");
        redirectUser();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        "Invalid email or password"
      );
    }
  };

  /* ---------------- OTP LOGIN ---------------- */
  const sendOtp = async () => {
    if (!values.email)
      return toast.error("Enter your email first");

    try {
      setOtpLoading(true);
      await api.post("/auth/request-login-otp", {
        email: values.email,
      });
      toast.success("OTP sent to your email");
      setOtpMode(true);
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();

    if (otp.length !== 6)
      return toast.error("Enter a valid 6-digit OTP");

    try {
      setOtpLoading(true);

      const res = await api.post("/auth/verify-otp", {
        email: values.email,
        otp,
        purpose: "login",
      });

      setSession(res);
      toast.success("Login successful");
      redirectUser();
    } catch {
      toast.error("Invalid OTP");
    } finally {
      setOtpLoading(false);
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
            onSubmit={(e) =>
              handleSubmit(e, handleEmailLogin)
            }
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
                  type={
                    showPassword ? "text" : "password"
                  }
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  className="w-full h-12 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((p) => !p)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
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
              className="w-full h-12 bg-black text-white rounded-lg"
            >
              {isSubmitting
                ? "Logging in..."
                : "Login"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <input
              type="text"
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(/\D/g, "")
                )
              }
              maxLength={6}
              className="w-full text-center text-xl tracking-widest border rounded-lg py-3"
              placeholder="Enter OTP"
            />

            <button
              type="submit"
              disabled={otpLoading}
              className="w-full h-12 bg-black text-white rounded-lg"
            >
              {otpLoading
                ? "Verifying..."
                : "Verify & Login"}
            </button>

            <button
              type="button"
              onClick={() => setOtpMode(false)}
              className="text-sm text-gray-500 w-full"
            >
              Back to password login
            </button>
          </form>
        )}

        {/* OTP BUTTON */}
        {!otpMode && (
          <button
            onClick={sendOtp}
            disabled={otpLoading}
            className="w-full mt-4 border rounded-lg py-3 flex items-center justify-center gap-2 text-sm"
          >
            <KeyRound size={16} />
            Login with OTP
          </button>
        )}

        {/* Google */}
        <div className="mt-6">
          <div className="text-center text-xs text-gray-400 mb-3">
            OR
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={async (res) => {
                try {
                  await login(
                    { credential: res.credential },
                    "google"
                  );
                  toast.success("Login successful");
                  redirectUser();
                } catch {
                  toast.error("Google login failed");
                }
              }}
              onError={() =>
                toast.error("Google login failed")
              }
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <Link to="/forgot-password" className="block">
            Forgot password?
          </Link>

          <p className="mt-2">
            Don’t have an account?{" "}
            <Link
              to="/register"
              className="text-black font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
}