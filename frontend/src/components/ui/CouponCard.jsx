import React, { useState, useEffect } from "react";
import { Tag, Copy, Check, Clock, Zap } from "lucide-react";
import toast from "react-hot-toast";

export default function CouponCard({ coupon, onApply }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const isUpcoming = coupon.status === "upcoming";

  const copyToClipboard = () => {
    if (isUpcoming) return;
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    toast.success("Code Transmitted to Clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const target = isUpcoming ? new Date(coupon.startDate) : new Date(coupon.expiryDate);
      const diff = Math.max(0, target - now);
      
      if (diff === 0) {
        setTimeLeft(isUpcoming ? "Starting..." : "EXPIRED");
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      if (h > 24) {
        setTimeLeft(`${Math.floor(h / 24)}d left`);
      } else {
        setTimeLeft(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [coupon.expiryDate, coupon.startDate, isUpcoming]);

  const discountValueStr = coupon.discountType === "percentage" 
    ? `${coupon.discountValue}% OFF` 
    : `₹${coupon.discountValue} OFF`;

  return (
    <div className={`relative group bg-white border border-gray-100 rounded-2xl p-4 shadow-sm transition-all overflow-hidden ${
      isUpcoming ? "opacity-75 grayscale-[0.5]" : "hover:shadow-md hover:border-[#0f172a]"
    }`}>
      {/* Background Decor */}
      <div className="absolute -top-6 -right-6 h-16 w-16 bg-gray-50 rounded-full group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative z-10 space-y-3">
        <div className="flex justify-between items-start">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
            isUpcoming ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-green-50 text-green-600 border-green-100"
          }`}>
            {isUpcoming ? (
              <><Clock size={10} /> ⏳ Coming Soon</>
            ) : (
              <><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> 🔥 Live</>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[7px] font-black uppercase tracking-widest text-gray-300">
               {isUpcoming ? "Starts In" : "Ends In"}
            </span>
            <span className="text-[9px] font-black text-[#0f172a] tabular-nums">
              {timeLeft}
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-[#0f172a] tracking-tight leading-none mb-1">
            {discountValueStr}
          </h3>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
            Min. Order: ₹{coupon.minOrderValue || 0}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div 
            onClick={copyToClipboard}
            className={`flex-1 flex items-center justify-between px-4 py-2 bg-[#f1f5f9] border border-dashed border-gray-200 rounded-xl transition-all ${
              isUpcoming ? "cursor-not-allowed" : "cursor-pointer hover:bg-white hover:border-[#0f172a] group/code"
            }`}
          >
            <span className="text-xs font-black text-[#0f172a] tracking-widest uppercase">
              {coupon.code}
            </span>
            {!isUpcoming && (
              copied ? (
                <Check size={12} className="text-green-500" />
              ) : (
                <Copy size={12} className="text-gray-300 group-hover/code:text-[#0f172a]" />
              )
            )}
            {isUpcoming && <Lock size={12} className="text-gray-300" />}
          </div>
          
          <button
            onClick={() => onApply(coupon.code)}
            disabled={isUpcoming}
            className={`h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-all shadow-md active:scale-95 ${
              isUpcoming ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#0f172a] text-white hover:bg-black"
            }`}
          >
            <Zap size={10} fill={isUpcoming ? "gray" : "white"} /> {isUpcoming ? "Locked" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
