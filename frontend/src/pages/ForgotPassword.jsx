import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import toast from "react-hot-toast";
import { Sparkles, ArrowRight, Mail } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validate = () => {
    if (!email.trim()) return "Please enter your email address.";
    if (!/\S+@\S+\.\S+/.test(email))
      return "Please enter a valid email address.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!executeRecaptcha) {
      toast.error("Verification failed. Please refresh and try again.");
      return;
    }

    setLoading(true);

    try {
      const token = await executeRecaptcha("forgot_password");

      await api.post("/auth/send-otp", {
        email,
        recaptchaToken: token,
      });

      toast.success("OTP sent to your email");
      navigate(
        `/verify-reset-otp?email=${encodeURIComponent(email)}`
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white border rounded-2xl p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-xs rounded-md mb-4">
              <Sparkles size={12} />
              Your Store
            </div>

            <h2 className="text-xl font-semibold text-gray-900">
              Forgot Password
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Enter your email to receive a verification code
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

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
                    setEmail(e.target.value.toLowerCase())
                  }
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="w-full h-12 pl-10 pr-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-black text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Remember your password?{" "}
            <Link
              to="/login"
              className="text-black font-medium hover:underline"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}