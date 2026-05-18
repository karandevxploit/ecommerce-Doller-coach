import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { api } from "../api/client";
import { useForm } from "../hooks/useForm";
import { registerValidator } from "../utils/validation";
import { useAuthStore } from "../store";
import { motion, AnimatePresence } from "framer-motion";

export default function Register() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const { openAuthModal } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);

  const {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setFieldValue,
  } = useForm(
    { name: "", email: "", phone: "", password: "" },
    registerValidator
  );

  const closePage = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------------- CLOSE ESC ---------------- */
  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") closePage();
    };

    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- REGISTER WITH ERROR HANDLING ---------------- */
  const handleRegister = async (formData) => {
    const payload = {
      name: formData.name?.trim() || "",
      email: formData.email?.toLowerCase().trim() || "",
      password: formData.password || "",
      phone: formData.phone?.replace(/\D/g, "").slice(0, 10) || undefined,
    };

    if (!payload.name || !payload.email || !payload.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (payload.phone && payload.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    try {
      const res = await api.post("/auth/register", payload);
      const data = res?.data ?? res;

      const success =
        data?.success === true ||
        data?.data?.success === true ||
        data?.message?.toLowerCase?.().includes("success");

      if (!success && data?.success === false) {
        toast.error(data?.message || "Registration failed. Please try again.");
        return;
      }

      toast.success(
        data?.message ||
        "Registration successful! Check your email for verification code."
      );

      navigate("/verify-otp", {
        state: {
          email: payload.email,
          from: "register",
          otpExpiresIn: data?.otpExpiresIn || data?.data?.otpExpiresIn,
        },
        replace: true,
      });
    } catch (err) {
      const status = err?.response?.status;
      let errorMsg = err?.response?.data?.message || "Registration failed";

      if (status === 400) {
        errorMsg = errorMsg || "Please check your input and try again.";
      } else if (status === 409) {
        errorMsg =
          errorMsg || "This email is already registered. Please login instead.";
      } else if (status === 503) {
        errorMsg = "Our servers are temporarily down. Please try again later.";
      } else if (status >= 500) {
        errorMsg = "An unexpected error occurred. Please try again later.";
      } else if (err.code === "ECONNABORTED") {
        errorMsg =
          "Request took too long. Please check your connection and try again.";
      } else if (!err.response) {
        errorMsg = "Network error. Please check your connection.";
      }

      if (mountedRef.current) {
        toast.error(errorMsg);
      }
    }
  };

  /* ---------------- UI ---------------- */
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
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
        >
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              Create Account
            </h2>

            <button
              type="button"
              onClick={closePage}
              aria-label="Close"
              className="p-2 rounded hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>

          {/* FORM */}
          <form
            onSubmit={(e) => handleSubmit(e, handleRegister)}
            className="space-y-4"
          >
            {/* NAME */}
            <Input
              icon={<User size={16} />}
              name="name"
              value={values.name}
              onChange={handleChange}
              placeholder="Full name"
              error={errors.name}
              autoComplete="name"
            />

            {/* EMAIL */}
            <Input
              icon={<Mail size={16} />}
              name="email"
              value={values.email}
              onChange={(e) => {
                setFieldValue("email", e.target.value.toLowerCase());
              }}
              placeholder="Email address"
              error={errors.email}
              type="email"
              autoComplete="email"
            />

            {/* PHONE */}
            <Input
              icon={<Phone size={16} />}
              name="phone"
              value={values.phone}
              onChange={(e) =>
                setFieldValue(
                  "phone",
                  e.target.value.replace(/\D/g, "").slice(0, 10)
                )
              }
              placeholder="10-digit mobile number"
              error={errors.phone}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
            />

            {/* PASSWORD */}
            <div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />

                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  placeholder="Create password"
                  aria-label="Password"
                  autoComplete="new-password"
                  className={`w-full h-12 pl-10 pr-10 border rounded-lg focus:ring-2 focus:ring-black outline-none ${errors.password ? "border-red-500" : ""
                    }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {errors.password && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.password}
                </p>
              )}
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                navigate("/");
                setTimeout(() => openAuthModal?.(), 0);
              }}
              className="text-black font-medium hover:underline"
            >
              Login
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ---------------- REUSABLE INPUT ---------------- */
function Input({ icon, error, ...props }) {
  return (
    <div>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </div>

        <input
          {...props}
          className={`w-full h-12 pl-10 pr-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-sm ${error ? "border-red-500" : ""
            }`}
        />
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
