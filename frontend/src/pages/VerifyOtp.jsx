import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { useAuthStore } from "../store";
import { motion } from "framer-motion";
import { api } from "../api/client";

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const purposeParam = (searchParams.get("purpose") || "signup").toLowerCase();

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || otp.length !== 6) return toast.error("Email and 6-digit OTP required.");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", {
        email: email.trim(),
        otp,
        purpose: purposeParam === "login" ? "login" : "signup",
      });
      setSession(res);
      toast.success("Verified");
      navigate("/");
    } catch (err) {
      toast.error("Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[60vh] flex items-center justify-center px-4 py-12 bg-white"
    >
      <div className="w-full max-w-md bg-[#f1f5f9] border border-gray-100 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Verify email</p>
            <h1 className="text-xl font-bold text-gray-900">Enter OTP</h1>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-2 mb-1">
              <Mail size={14} /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-center text-2xl tracking-[0.4em] font-mono"
              placeholder="000000"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "…" : "Verify"} <ArrowRight size={18} />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
