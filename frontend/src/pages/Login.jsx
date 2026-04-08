import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, Mail, Lock, ShieldCheck, Globe, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../store";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { GoogleLogin } from "@react-oauth/google";

import { useForm } from "../hooks/useForm";
import { loginValidator } from "../utils/validation";

export default function Login() {
  const navigate = useNavigate();
  const { login, setSession } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState("");

  const { values, errors, isSubmitting, handleChange, handleSubmit } = useForm(
    { email: "", password: "" },
    loginValidator
  );

  const handleEmailLogin = async (formValues) => {
    try {
      await login({ ...formValues, provider: "email" }, "login");
      navigate("/");
    } catch {
      const msg = err?.response?.data?.message || "Invalid credentials";
      toast.error(msg);
    }
  };

  const sendLoginOtp = async () => {
    if (!values.email) return toast.error("Enter your email first.");
    try {
      await api.post("/auth/request-login-otp", { email: values.email });
      toast.success("If this email is registered, you will receive an OTP.");
      setOtpMode(true);
    } catch {
      toast.error("Could not send OTP.");
    }
  };

  const verifyLoginOtp = async (e) => {
    e.preventDefault();
    if (!otp) return toast.error("OTP required.");
    try {
      const res = await api.post("/auth/verify-otp", { email: values.email, otp, purpose: "login" });
      setSession(res);
      navigate("/");
    } catch {
      toast.error("Invalid OTP.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 bg-slate-50"
    >
      <div className="w-full max-w-[500px] flex flex-col items-center">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 bg-[#1e3a8a] text-[#0f172a] rounded-lg flex items-center justify-center shadow-sm">
            <ShieldCheck size={20} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-[#1e3a8a] tracking-tight uppercase leading-none">
              DOLLER <span className="text-[#0f172a]">Coach</span>
            </h1>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1 uppercase">
              (By Gangwani and Company)
            </p>
          </div>
        </div>

        <div className="w-full bg-white border border-[#F2F2F2] rounded-[2rem] p-10 shadow-sm">
          <div className="mb-10 space-y-2">
            <h2 className="text-3xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">Sign in</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
              Authenticate via secure credentials or temporary access code
            </p>
          </div>

          {!otpMode ? (
            <form onSubmit={(e) => handleSubmit(e, handleEmailLogin)} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                  <input
                    type="email"
                    name="email"
                    value={values.email}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-4 py-3 rounded-lg bg-white border ${errors.email ? 'border-red-500' : 'border-transparent'} text-[#0f172a] font-bold text-sm focus:border-[#1e3a8a] outline-none shadow-sm`}
                  />
                </div>
                {errors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={values.password}
                    onChange={handleChange}
                    className={`w-full pl-12 pr-12 py-3 rounded-lg bg-white border ${errors.password ? 'border-red-500' : 'border-transparent'} text-[#0f172a] font-bold text-sm focus:border-[#1e3a8a] outline-none shadow-sm`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-[#0f172a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-md hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? "Verifying..." : "Authenticate"} <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={verifyLoginOtp} className="space-y-6">
              <p className="text-xs text-gray-600">Enter the 6-digit code sent to your email.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-3 rounded-lg bg-white border text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-50"
              >
                Verify & sign in
              </button>
              <button type="button" onClick={() => setOtpMode(false)} className="w-full text-sm text-gray-500">
                Back to password
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {!otpMode && (
                <button
                type="button"
                onClick={sendLoginOtp}
                disabled={isSubmitting}
                className="w-full h-12 border border-gray-100 bg-gray-50/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#0f172a] hover:bg-gray-100 flex items-center justify-center gap-2 transition-all"
              >
                <KeyRound size={16} /> Request OTP Manifest
              </button>
            )}
            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold px-2 bg-[#f1f5f9] text-gray-400">Or continue with</div>
              </div>
              
              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    try {
                      await login({ credential: credentialResponse.credential }, "google");
                      navigate("/");
                    } catch {
                      const msg = err?.response?.data?.message || "";
                      if (msg.includes("origin") || msg.includes("allowed")) {
                        toast.error("Google Origin Mismatch: Add http://localhost:3000 to Google Cloud Console.");
                      } else {
                        toast.error("Google verify failed");
                      }
                    }
                  }}
                  onError={() => {
                    toast.error("Google sign-in failed. Check browser console for Origin Mismatch.");
                  }}
                  useOneTap
                  theme="filled_blue"
                  shape="pill"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#F2F2F2] text-center">
            <Link to="/register" className="text-sm font-semibold text-indigo-600 hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
