import React, { useState, useEffect, useRef } from "react";
import { Copy, Check, Clock, Zap, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function CouponCard({ coupon = {}, onApply }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const timerRef = useRef(null);

  const isUpcoming = coupon?.status === "upcoming";
  const isExpired = coupon?.status === "expired";

  const safeCode = coupon?.code || "";
  const safeMinOrder = coupon?.minOrderValue || 0;

  const fallbackCopy = (text) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  };

  const copyToClipboard = async () => {
    if (!safeCode || isUpcoming || isExpired) return;

    let success = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeCode);
        success = true;
      } else {
        success = fallbackCopy(safeCode);
      }
    } catch {
      success = fallbackCopy(safeCode);
    }

    if (success) {
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Unable to copy code");
    }
  };

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const now = new Date();
      const target = isUpcoming
        ? new Date(coupon?.startDate)
        : new Date(coupon?.expiryDate);

      const diff = target - now;

      if (!target || isNaN(target)) {
        setTimeLeft("");
        return;
      }

      if (diff <= 0) {
        setTimeLeft(isUpcoming ? "Starting soon" : "Expired");
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      if (h >= 24) {
        setTimeLeft(`${Math.floor(h / 24)}d left`);
      } else {
        setTimeLeft(
          `${String(h).padStart(2, "0")}h ${String(m).padStart(
            2,
            "0"
          )}m ${String(s).padStart(2, "0")}s`
        );
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [coupon?.expiryDate, coupon?.startDate, isUpcoming]);

  const discountValueStr =
    coupon?.discountType === "percentage"
      ? `${coupon?.discountValue || 0}% OFF`
      : `₹${coupon?.discountValue || 0} OFF`;

  return (
    <div
      className={`relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition ${isUpcoming || isExpired
          ? "opacity-70"
          : "hover:shadow-md hover:border-slate-300"
        }`}
      role="region"
      aria-label={`Coupon ${safeCode}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${isUpcoming
              ? "bg-yellow-100 text-yellow-700"
              : isExpired
                ? "bg-red-100 text-red-600"
                : "bg-green-100 text-green-700"
            }`}
        >
          {isUpcoming ? (
            <>
              <Clock size={12} /> Coming soon
            </>
          ) : isExpired ? (
            <>Expired</>
          ) : (
            <>Active</>
          )}
        </div>

        <div className="text-right">
          <p className="text-[10px] text-slate-400">
            {isUpcoming ? "Starts in" : "Ends in"}
          </p>
          <p className="text-xs font-semibold text-slate-800">
            {timeLeft || "--"}
          </p>
        </div>
      </div>

      {/* Discount */}
      <div className="mb-3">
        <h3 className="text-lg font-bold text-slate-900">
          {discountValueStr}
        </h3>
        <p className="text-xs text-slate-500">
          Minimum order ₹{safeMinOrder}
        </p>
      </div>

      {/* Code + Action */}
      <div className="flex items-center gap-2">
        <button
          onClick={copyToClipboard}
          disabled={isUpcoming || isExpired}
          aria-label="Copy coupon code"
          className={`flex-1 flex items-center justify-between px-3 py-2 border border-dashed rounded-lg text-sm ${isUpcoming || isExpired
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-slate-50 hover:bg-white hover:border-slate-400"
            }`}
        >
          <span className="font-semibold tracking-wide uppercase">
            {safeCode || "N/A"}
          </span>

          {isUpcoming || isExpired ? (
            <Lock size={14} />
          ) : copied ? (
            <Check size={14} className="text-green-600" />
          ) : (
            <Copy size={14} />
          )}
        </button>

        <button
          onClick={() => onApply?.(safeCode)}
          disabled={isUpcoming || isExpired}
          className={`h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1 ${isUpcoming || isExpired
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
        >
          <Zap size={14} />
          {isUpcoming ? "Locked" : isExpired ? "Expired" : "Apply"}
        </button>
      </div>
    </div>
  );
}