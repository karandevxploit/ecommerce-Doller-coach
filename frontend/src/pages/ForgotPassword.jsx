import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import toast from "react-hot-toast";
import { Sparkles, ArrowRight, Mail, Key } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Enter registered email");
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email });
      toast.success("Security Update Sent");
      navigate(`/verify-reset-otp?email=${encodeURIComponent(email)}`);
    } catch {
      toast.error(err?.response?.data?.message || "Failed to emit update");
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
            <h2 className="text-lg font-black text-[#0f172a] tracking-tighter uppercase leading-none">Recovery</h2>
            <p className="text-[9px] text-gray-400 font-black mt-2 uppercase tracking-widest">Secure reset update</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Iduser Update</label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#1e3a8a] text-[#0f172a] rounded-lg text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-sm hover:-translate-y-1 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {loading ? "Emitting Update..." : "Send OTP"} <ArrowRight size={18} strokeWidth={3} />
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
               A secure 6-digit sequence will be sent to your nexus.
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              Recall iduser? <Link to="/login" className="text-[#0f172a] font-black hover:text-[#1e3a8a] transition-colors underline underline-offset-4">Login</Link>
            </p>
          </div>
          
          <div className="mt-6 flex justify-center gap-3">
             <Key size={14} className="text-[#1e3a8a]" />
             <Mail size={14} className="text-[#1e3a8a]" />
          </div>
        </div>
      </div>
    </div>
  );
}
