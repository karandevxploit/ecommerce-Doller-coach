import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Lock,
  Key,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mountedRef = useRef(true);

  const initialEmail =
    params.get("email") || params.get("user") || params.get("e") || "";
  const initialToken =
    params.get("token") || params.get("otp") || params.get("code") || "";

  const [email] = useState(initialEmail.trim().toLowerCase());
  const [token, setToken] = useState(initialToken.trim());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearError = () => {
    if (error) setError("");
  };

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    const safeEmail = email.trim().toLowerCase();
    const safeToken = token.trim();

    if (!safeEmail) return "Missing email information.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return "Invalid email information.";
    }

    if (!safeToken) return "Please enter the verification code.";
    if (safeToken.length < 4) return "Invalid verification code.";

    if (!password) return "Please enter a new password.";
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
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
    const safeToken = token.trim();

    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        email: safeEmail,
        resetToken: safeToken,
        token: safeToken,
        otp: safeToken,
        newPassword: password,
        password,
      });

      toast.success("Password updated successfully");
      navigate("/login", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Failed to reset password. Please try again.";

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

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-sm border">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold">
            Reset Password
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your verification code and new password
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error */}
          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-sm text-gray-600">
              Email
            </label>
            <div className="relative mt-1">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="email"
                value={email}
                disabled
                className="w-full h-12 pl-10 pr-3 border rounded-lg bg-gray-100 text-gray-500"
              />
            </div>
          </div>

          {/* Token */}
          <div>
            <label className="text-sm text-gray-600">
              Verification Code
            </label>
            <div className="relative mt-1">
              <Key
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value.trim());
                  clearError();
                }}
                placeholder="Enter code"
                aria-label="Verification code"
                autoComplete="one-time-code"
                className="w-full h-12 pl-10 pr-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm text-gray-600">
              New Password
            </label>
            <div className="relative mt-1">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                placeholder="Enter new password"
                autoComplete="new-password"
                className="w-full h-12 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass((prev) => !prev)}
                aria-label={showPass ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-sm text-gray-600">
              Confirm Password
            </label>
            <div className="relative mt-1">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showConfirmPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError();
                }}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className="w-full h-12 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-black outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass((prev) => !prev)}
                aria-label={
                  showConfirmPass
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? "Updating password..." : "Update Password"}
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
  );
}
