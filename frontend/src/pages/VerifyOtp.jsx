import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  ShieldCheck,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useAuthStore, useCartStore, useWishlistStore } from "../store";
import { resumePendingAction } from "../utils/authActions";
import { motion } from "framer-motion";
import { api } from "../api/client";

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const cartStore = useCartStore();
  const wishlistStore = useWishlistStore();

  const emailParam = searchParams.get("email") || "";
  const purposeParam =
    (searchParams.get("purpose") || "signup").toLowerCase();

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(30);

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    if (timer <= 0) return;
    const t = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [timer]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    if (!email.trim()) return "Please enter your email.";
    if (!/\S+@\S+\.\S+/.test(email))
      return "Enter a valid email address.";
    if (otp.length !== 6)
      return "Enter a valid 6-digit code.";
    return "";
  };

  /* ---------------- VERIFY ---------------- */
  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", {
        email: email.trim(),
        otp,
        purpose:
          purposeParam === "login" ? "login" : "signup",
      });

      setSession(res);
      toast.success("Verification successful");

      const resumed = await resumePendingAction({ cartStore, wishlistStore, navigate });
      if (resumed) return;

      navigate("/");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Invalid or expired code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- RESEND OTP ---------------- */
  const resendOtp = async () => {
    if (!email.trim()) {
      return toast.error("Enter your email first");
    }

    try {
      setResendLoading(true);

      await api.post("/auth/resend-otp", {
        email: email.trim(),
        purpose:
          purposeParam === "login" ? "login" : "signup",
      });

      toast.success("New code sent");
      setTimer(30);
    } catch {
      toast.error("Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center px-4 bg-gray-50"
    >
      <div className="w-full max-w-md bg-white border rounded-2xl p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-black text-white rounded-lg flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase">
              Email Verification
            </p>
            <h1 className="text-xl font-semibold">
              Enter Verification Code
            </h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          {/* Error */}
          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-sm text-gray-600">
              Email Address
            </label>
            <div className="relative mt-1">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full h-12 pl-10 pr-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                aria-label="Email address"
              />
            </div>
          </div>

          {/* OTP */}
          <div>
            <label className="text-sm text-gray-600">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(/\D/g, "")
                )
              }
              placeholder="Enter 6-digit code"
              aria-label="Verification code"
              className="w-full h-12 text-center text-lg tracking-widest border rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading
              ? "Verifying..."
              : "Verify Code"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Resend */}
        <div className="mt-5 text-center text-sm text-gray-500">
          {timer > 0 ? (
            <p>Resend code in {timer}s</p>
          ) : (
            <button
              onClick={resendOtp}
              disabled={resendLoading}
              className="text-black font-medium flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw size={14} />
              Resend Code
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="text-gray-500 hover:text-black"
          >
            Back to login
          </Link>
        </div>
      </div>
    </motion.div>
  );
}