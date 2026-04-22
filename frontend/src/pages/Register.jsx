import { useState, useEffect } from "react";
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
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { motion, AnimatePresence } from "framer-motion";

export default function Register() {
  const navigate = useNavigate();
  const { openAuthModal } = useAuthStore();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [showPassword, setShowPassword] = useState(false);

  const {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
  } = useForm(
    { name: "", email: "", phone: "", password: "" },
    registerValidator
  );

  /* ---------------- CLOSE ESC ---------------- */
  useEffect(() => {
    const esc = (e) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [navigate]);

  /* ---------------- REGISTER ---------------- */
  const handleRegister = async (formData) => {
    if (!executeRecaptcha) {
      toast.error("Please wait, verifying security...");
      return;
    }

    try {
      const token = await executeRecaptcha("register");

      await api.post("/auth/register", {
        ...formData,
        recaptchaToken: token,
      });

      toast.success("Verification code sent to your email");

      navigate(
        `/verify?email=${encodeURIComponent(
          formData.email
        )}&purpose=signup`
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Registration failed. Please try again.";
      toast.error(msg);
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
          onClick={() => navigate(-1)}
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
              onClick={() => navigate(-1)}
              aria-label="Close"
              className="p-2 rounded hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>

          {/* FORM */}
          <form
            onSubmit={(e) =>
              handleSubmit(e, handleRegister)
            }
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
            />

            {/* EMAIL */}
            <Input
              icon={<Mail size={16} />}
              name="email"
              value={values.email}
              onChange={handleChange}
              placeholder="Email address"
              error={errors.email}
              type="email"
            />

            {/* PHONE */}
            <Input
              icon={<Phone size={16} />}
              name="phone"
              value={values.phone}
              onChange={(e) =>
                handleChange({
                  target: {
                    name: "phone",
                    value: e.target.value.replace(/\D/g, ""),
                  },
                })
              }
              placeholder="10-digit mobile number"
              error={errors.phone}
              type="tel"
            />

            {/* PASSWORD */}
            <div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />

                <input
                  type={
                    showPassword ? "text" : "password"
                  }
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  placeholder="Create password"
                  aria-label="Password"
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
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
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
              {isSubmitting
                ? "Creating account..."
                : "Create Account"}
              {!isSubmitting && (
                <ArrowRight size={16} />
              )}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <button
              onClick={() => {
                navigate("/");
                openAuthModal();
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
function Input({
  icon,
  error,
  ...props
}) {
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