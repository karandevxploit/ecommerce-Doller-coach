import { useEffect, useRef, useState } from "react";
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
  const mountedRef = useRef(true);

  const [email, setEmail] = useState(
    (params.get("email") || "").trim().toLowerCase()
  );
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearError = () => {
    if (error) setError("");
  };

  /* ---------------- TIMER ---------------- */
  useEffect(() => {
    if (timer <= 0) return undefined;

    const timeout = setTimeout(() => {
      setTimer((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [timer]);

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    const safeEmail = email.trim().toLowerCase();

    if (!safeEmail) return "Please enter your email.";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return "Enter a valid email address.";
    }

    if (!/^\d{6}$/.test(otp)) {
      return "Enter a valid 6-digit code.";
    }

    return "";
  };

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const safeEmail = email.trim().toLowerCase();

    setLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", {
        email: safeEmail,
        otp,
        purpose: "reset",
      });

      const data = res?.data ?? res;
      const payload = data?.data ?? data;

      const resetToken =
        payload?.resetToken ||
        payload?.token ||
        payload?.reset_token ||
        data?.resetToken ||
        data?.token ||
        otp;

      if (!resetToken) {
        throw new Error("Invalid response");
      }

      toast.success("Code verified");

      navigate(
        `/reset-password?email=${encodeURIComponent(
          safeEmail
        )}&token=${encodeURIComponent(resetToken)}`,
        { replace: true }
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Invalid or expired code.";

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

  /* ---------------- RESEND ---------------- */
  const resendOtp = async () => {
    const safeEmail = email.trim().toLowerCase();

    if (!safeEmail) {
      return toast.error("Enter your email first");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return toast.error("Enter a valid email address");
    }

    if (resendLoading || timer > 0) return;

    try {
      setResendLoading(true);

      await api.post("/auth/send-otp", {
        email: safeEmail,
        purpose: "reset",
      });

      toast.success("New code sent");
      setTimer(30);
      setOtp("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code");
    } finally {
      if (mountedRef.current) {
        setResendLoading(false);
      }
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
                onChange={(e) => {
                  setEmail(e.target.value.toLowerCase());
                  clearError();
                }}
                autoComplete="email"
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
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                clearError();
              }}
              placeholder="Enter code"
              autoComplete="one-time-code"
              className="w-full h-12 text-center text-lg tracking-widest border rounded-lg focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify Code"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Resend */}
        <div className="mt-5 text-center text-sm text-gray-500">
          {timer > 0 ? (
            <p>Resend code in {timer}s</p>
          ) : (
            <button
              type="button"
              onClick={resendOtp}
              disabled={resendLoading}
              className="text-black font-medium flex items-center justify-center gap-2 mx-auto disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={resendLoading ? "animate-spin" : ""}
              />
              {resendLoading ? "Sending..." : "Resend Code"}
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
