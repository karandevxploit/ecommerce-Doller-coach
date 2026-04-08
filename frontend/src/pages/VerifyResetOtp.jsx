import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import toast from "react-hot-toast";
import { Sparkles, ArrowRight, Mail, ShieldCheck } from "lucide-react";

export default function VerifyResetOtp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !otp) return toast.error("Enter email and OTP update");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", { email, otp });
      const resetToken = res?.resetToken;
      if (!resetToken) {
        toast.error("Invalid secure response");
        return;
      }
      toast.success("Iduser Verified");
      navigate(
        `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(resetToken)}`
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "OTP sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center py-8 bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#f1f5f9] border border-gray-100 rounded-xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all">
              <Sparkles size={12} className="text-[#1e3a8a]" strokeWidth={3} /> Doller Coach
            </div>
            <h2 className="text-lg font-black text-[#0f172a] tracking-tighter uppercase leading-none">Save System</h2>
            <p className="text-[9px] text-gray-400 font-black mt-2 uppercase tracking-widest">Verify the 6-digit sequence</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Iduser</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                  type="email"
                  placeholder="USER@NEXUS"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-lg bg-white border border-transparent text-[#0f172a] font-black uppercase tracking-widest text-xs focus:border-[#1e3a8a] outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Verification Update</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-[#1e3a8a] text-[#0f172a] rounded-full text-[13px] font-black uppercase tracking-widest shadow-sm hover:shadow-sm hover:-translate-y-1 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {loading ? "Saveing..." : "Verify Sequence"} <ArrowRight size={18} strokeWidth={3} />
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
               Check inbox for sequence.
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              No update? <Link to="/forgot-password" className="text-[#0f172a] font-black hover:text-[#1e3a8a] transition-colors underline underline-offset-4">Resend</Link>
            </p>
          </div>
          
          <div className="mt-6 flex justify-center gap-3">
             <ShieldCheck size={14} className="text-[#1e3a8a]" />
             <Sparkles size={14} className="text-[#1e3a8a]" />
          </div>
        </div>
      </div>
    </div>
  );
}
