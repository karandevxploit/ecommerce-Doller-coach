import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Mail, 
  Lock, 
  ShieldCheck, 
  User as UserIcon, 
  Phone, 
  Eye, 
  EyeOff 
} from "lucide-react";
import { api } from "../api/client";
import { useForm } from "../hooks/useForm";
import { registerValidator } from "../utils/validation";

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const { values, errors, isSubmitting, handleChange, handleSubmit } = useForm(
    { name: "", email: "", phone: "", password: "" },
    registerValidator
  );

  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: "", color: "bg-gray-200" };
    if (pass.length < 6) return { score: 1, label: "Weak", color: "bg-red-500" };
    if (pass.length < 10) return { score: 2, label: "Medium", color: "bg-yellow-500" };
    return { score: 3, label: "Strong", color: "bg-green-500" };
  };

  const strength = getPasswordStrength(values.password);

  const handleEmailSignup = async (formValues) => {
    try {
      await api.post("/auth/register", formValues);
      toast.success("Check your email for the 6-digit code.");
      navigate(`/verify?email=${encodeURIComponent(formValues.email)}&purpose=signup`);
    } catch (err) {
      console.log(err);
      toast.error(err?.response?.data?.message || "Registration failed. Please try again.");
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
            <h2 className="text-3xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">Membership</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
              Create your profile to access exclusive seasonal manifests
            </p>
          </div>

          <form onSubmit={(e) => handleSubmit(e, handleEmailSignup)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Full name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                  type="text"
                  name="name"
                  value={values.name}
                  onChange={handleChange}
                  className={`w-full pl-12 pr-4 py-3 rounded-lg bg-white border ${errors.name ? 'border-red-500' : 'border-transparent'} text-[#0f172a] font-bold text-sm focus:border-[#1e3a8a] outline-none shadow-sm`}
                />
              </div>
              {errors.name && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.name}</p>}
            </div>

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
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input
                  type="tel"
                  name="phone"
                  value={values.phone}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  className={`w-full pl-12 pr-4 py-3 rounded-lg bg-white border ${errors.phone ? 'border-red-500' : 'border-transparent'} text-[#0f172a] font-bold text-sm focus:border-[#1e3a8a] outline-none shadow-sm`}
                />
              </div>
              {errors.phone && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.phone}</p>}
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
              
              {values.password && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className={`flex-1 rounded-full transition-all duration-300 ${strength.score >= s ? strength.color : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <p className={`text-[8px] font-black uppercase tracking-widest text-right`} style={{ color: strength.color.replace('bg-', 'var(--tw-') }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-[#0f172a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-md hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? "Registering..." : "Join Inner Circle"} <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#F2F2F2] text-center">
            <Link to="/login" className="text-sm font-semibold text-indigo-600 hover:underline">
              Already have an account?
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
