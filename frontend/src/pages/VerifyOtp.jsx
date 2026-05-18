import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Mail,
  Clock,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../store";
import { motion, AnimatePresence } from "framer-motion";

const EMPTY_OTP = ["", "", "", "", "", ""];

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const { setSession } = useAuthStore();

  const mountedRef = useRef(true);
  const inputRefs = useRef([]);
  const autoSubmitRef = useRef(false);

  const [otp, setOtp] = useState(EMPTY_OTP);
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("register");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const closePage = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/register");
    }
  }, [navigate]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Get email from navigation state
  useEffect(() => {
    const stateEmail =
      location.state?.email ||
      new URLSearchParams(location.search).get("email") ||
      "";

    if (stateEmail) {
      setEmail(String(stateEmail).trim().toLowerCase());
      setSource(location.state?.from || "register");
      setCountdown(Number(location.state?.otpExpiresIn) > 0 ? 0 : 0);
      return;
    }

    navigate("/register", { replace: true });
  }, [location.state, location.search, navigate]);

  // Focus first input
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return undefined;

    const timer = setTimeout(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  /* ---------------- CLOSE ESC ---------------- */
  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") closePage();
    };

    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [closePage]);

  /* ---------------- OTP INPUT HANDLING ---------------- */
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    autoSubmitRef.current = false;

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();

    const paste = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!paste) return;

    const newOtp = [...EMPTY_OTP];

    paste.split("").forEach((char, index) => {
      newOtp[index] = char;
    });

    setOtp(newOtp);
    autoSubmitRef.current = false;

    const nextIndex = Math.min(paste.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  /* ---------------- VERIFY OTP ---------------- */
  const handleVerifyOtp = useCallback(async () => {
    const otpString = otp.join("");

    if (loading) return;

    if (!email) {
      toast.error("Email missing. Please register again.");
      navigate("/register", { replace: true });
      return;
    }

    if (!/^\d{6}$/.test(otpString)) {
      toast.error("Please enter complete 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", {
        email,
        otp: otpString,
        purpose: source === "login" ? "login" : "register",
      });

      const data = res?.data ?? res;
      const payload = data?.data ?? data;

      const hasSession =
        payload?.token ||
        payload?.accessToken ||
        payload?.user ||
        data?.token ||
        data?.accessToken;

      if (hasSession) {
        setSession?.(payload);
      }

      toast.success("Email verified successfully! Welcome to Doller Coach.");
      navigate("/", { replace: true });
    } catch (err) {
      autoSubmitRef.current = false;

      const msg =
        err?.response?.data?.message ||
        "Verification failed. Please try again.";

      toast.error(msg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [otp, loading, email, source, navigate, setSession]);

  /* ---------------- RESEND OTP ---------------- */
  const handleResendOtp = async () => {
    if (countdown > 0 || resendLoading) return;

    if (!email) {
      toast.error("Email missing. Please register again.");
      navigate("/register", { replace: true });
      return;
    }

    setResendLoading(true);

    try {
      const endpoint =
        source === "login" ? "/auth/request-login-otp" : "/auth/resend-otp";

      const res = await api.post(endpoint, {
        email,
        purpose: source === "login" ? "login" : "register",
      });

      const data = res?.data ?? res;

      if (data?.success === false) {
        toast.error(data?.message || "Failed to resend OTP");
        return;
      }

      toast.success("OTP sent successfully!");
      setCountdown(60);
      setOtp(EMPTY_OTP);
      autoSubmitRef.current = false;
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to resend OTP";
      toast.error(msg);
    } finally {
      if (mountedRef.current) {
        setResendLoading(false);
      }
    }
  };

  /* ---------------- AUTO SUBMIT ON COMPLETE ---------------- */
  useEffect(() => {
    const otpString = otp.join("");

    if (!/^\d{6}$/.test(otpString)) return undefined;
    if (autoSubmitRef.current || loading) return undefined;

    autoSubmitRef.current = true;

    const timer = setTimeout(() => {
      handleVerifyOtp();
    }, 500);

    return () => clearTimeout(timer);
  }, [otp, loading, handleVerifyOtp]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        {/* BACKDROP */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closePage}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* MODAL */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-8"
        >
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verify Your Email
            </h2>

            <p className="text-gray-600">
              We've sent a 6-digit code to
            </p>

            <p className="font-medium text-gray-900">{email}</p>
          </div>

          {/* OTP INPUTS */}
          <div className="flex justify-center gap-3 mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                disabled={loading}
                aria-label={`OTP digit ${index + 1}`}
              />
            ))}
          </div>

          {/* VERIFY BUTTON */}
          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading || otp.join("").length !== 6}
            className="w-full h-12 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mb-4"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

          {/* RESEND SECTION */}
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-3">
              Didn't receive the code?
            </p>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading || countdown > 0}
              className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400 mx-auto"
            >
              {resendLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : countdown > 0 ? (
                <Clock className="w-4 h-4" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}

              {resendLoading
                ? "Sending..."
                : countdown > 0
                  ? `Resend in ${countdown}s`
                  : "Resend Code"}
            </button>
          </div>

          {/* BACK BUTTON */}
          <button
            type="button"
            onClick={closePage}
            className="absolute top-4 left-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
