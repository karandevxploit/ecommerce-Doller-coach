import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import toast from "react-hot-toast";
import { Sparkles, ArrowRight, Lock, Key, Mail } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [token, setToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !token || !newPassword) return toast.error("Complete the security logic");
    if (newPassword.length < 6) return toast.error("New password must be at least 6 characters");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        resetToken: token,
        newPassword,
      });
      toast.success("Security System Updated");
      navigate("/login");
    } catch {
      toast.error(err?.response?.data?.message || "Reset sequence failed");
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
            <h2 className="text-lg font-black text-[#0f172a] tracking-tighter uppercase leading-none">Save logic</h2>
            <p className="text-[9px] text-gray-400 font-black mt-2 uppercase tracking-widest">Define new security entry</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Iduser Account</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  disabled
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#f1f5f9] border border-gray-200 text-gray-400 text-sm font-medium focus:outline-none transition-all shadow-inner cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Token</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                  type="text"
                  placeholder="SECURITY_TOKEN"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-lg bg-white border border-transparent text-[#0f172a] font-black uppercase tracking-widest text-xs focus:border-[#1e3a8a] outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">New Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-lg bg-white border border-transparent text-[#0f172a] font-black uppercase tracking-widest text-xs focus:border-[#1e3a8a] outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-[#1e3a8a] text-[#0f172a] rounded-full text-[13px] font-black uppercase tracking-widest shadow-sm hover:shadow-sm hover:-translate-y-1 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
            >
              {loading ? "Saveing..." : "Update System"} <ArrowRight size={18} strokeWidth={3} />
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-4">
               Iduser will be updated across all endpoints.
            </p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              Abort recovery? <Link to="/login" className="text-[#0f172a] font-black hover:text-[#1e3a8a] transition-colors underline underline-offset-4">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
