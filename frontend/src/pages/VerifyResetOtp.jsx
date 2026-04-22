import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Mail,
  RefreshCw,
} from "lucide-react";

export default function VerifyResetOtp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState(
    params.get("email") || ""
  );
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] =
    useState(false);
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

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    if (!email.trim()) return "Please enter your email.";
    if (!/\S+@\S+\.\S+/.test(email))
      return "Enter a valid email address.";
    if (otp.length !== 6)
      return "Enter a valid 6-digit code.";
    return "";
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
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
        purpose: "reset",
      });

      const resetToken =
        res?.resetToken ||
        res?.data?.resetToken;

      if (!resetToken) {
        throw new Error("Invalid response");
      }

      toast.success("Code verified");

      navigate(
        `/reset-password?email=${encodeURIComponent(
          email
        )}&token=${encodeURIComponent(resetToken)}`
      );
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

  /* ---------------- RESEND ---------------- */
  const resendOtp = async () => {
    if (!email.trim()) {
      return toast.error("Enter your email first");
    }

    try {
      setResendLoading(true);

      await api.post("/auth/send-otp", {
        email: email.trim(),
        purpose: "reset",
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white border rounded-2xl p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold">
            Verify Reset Code
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter the code sent to your email
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>
          </div>

          {/* OTP */}
          <div>
            <label className="text-sm text-gray-600">
              6-digit Code
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
              placeholder="Enter code"
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
    </div>
  );
}