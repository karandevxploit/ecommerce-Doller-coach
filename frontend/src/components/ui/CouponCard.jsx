import { useState, useEffect, useRef, useMemo } from "react";
import { Copy, Check, Clock, Zap, Lock } from "lucide-react";
import toast from "react-hot-toast";

const normalizeStatus = (status) => {
  return String(status || "").trim().toLowerCase();
};

const normalizeCode = (coupon) => {
  return String(coupon?.code || coupon?.couponCode || "").trim().toUpperCase();
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getValidDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatMinOrder = (value) => {
  return safeNumber(value).toLocaleString("en-IN");
};

const fallbackCopy = (text) => {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");

  try {
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    if (textarea.parentNode) {
      document.body.removeChild(textarea);
    }
  }
};

export default function CouponCard({ coupon = {}, onApply }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const copyTimeoutRef = useRef(null);

  const status = normalizeStatus(coupon?.status);
  const isUpcoming = status === "upcoming" || status === "coming";
  const isExpired = status === "expired";
  const isLocked = isUpcoming || isExpired;

  const safeCode = normalizeCode(coupon);
  const safeMinOrder = coupon?.minOrderValue ?? coupon?.minOrderAmount ?? 0;

  const targetDate = useMemo(() => {
    return isUpcoming
      ? getValidDate(coupon?.startDate)
      : getValidDate(coupon?.expiryDate || coupon?.endDate);
  }, [coupon?.startDate, coupon?.expiryDate, coupon?.endDate, isUpcoming]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const updateTimeLeft = () => {
      if (!targetDate) {
        setTimeLeft("");
        return;
      }

      const diff = targetDate.getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft(isUpcoming ? "Starting soon" : "Expired");
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours >= 24) {
        setTimeLeft(`${Math.floor(hours / 24)}d left`);
        return;
      }

      setTimeLeft(
        `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(
          2,
          "0"
        )}m ${String(seconds).padStart(2, "0")}s`
      );
    };

    updateTimeLeft();

    const timer = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate, isUpcoming]);

  const discountValueStr =
    coupon?.discountType === "percentage"
      ? `${safeNumber(coupon?.discountValue ?? coupon?.discount)}% OFF`
      : `₹${safeNumber(coupon?.discountValue ?? coupon?.discount).toLocaleString(
        "en-IN"
      )} OFF`;

  const copyToClipboard = async () => {
    if (!safeCode || isLocked) return;

    let success = false;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeCode);
        success = true;
      } else {
        success = fallbackCopy(safeCode);
      }
    } catch {
      success = fallbackCopy(safeCode);
    }

    if (success) {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      setCopied(true);
      toast.success("Code copied");

      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } else {
      toast.error("Unable to copy code");
    }
  };

  const handleApply = () => {
    if (!safeCode || isLocked) return;
    onApply?.(safeCode);
  };

  return (
    <div
      className={`relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition ${isLocked ? "opacity-70" : "hover:shadow-md hover:border-slate-300"
        }`}
      role="region"
      aria-label={`Coupon ${safeCode || "unavailable"}`}
    >
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

      <div className="mb-3">
        <h3 className="text-lg font-bold text-slate-900">
          {discountValueStr}
        </h3>
        <p className="text-xs text-slate-500">
          Minimum order ₹{formatMinOrder(safeMinOrder)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyToClipboard}
          disabled={isLocked}
          aria-label="Copy coupon code"
          className={`flex-1 flex items-center justify-between px-3 py-2 border border-dashed rounded-lg text-sm ${isLocked
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-slate-50 hover:bg-white hover:border-slate-400"
            }`}
        >
          <span className="font-semibold tracking-wide uppercase">
            {safeCode || "N/A"}
          </span>

          {isLocked ? (
            <Lock size={14} />
          ) : copied ? (
            <Check size={14} className="text-green-600" />
          ) : (
            <Copy size={14} />
          )}
        </button>

        <button
          type="button"
          onClick={handleApply}
          disabled={isLocked}
          className={`h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-1 ${isLocked
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
