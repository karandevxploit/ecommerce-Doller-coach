import { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

/**
 * CouponBox
 * Displays and copies coupon codes with proper UX & accessibility
 */
export default function CouponBox({ code, discountText }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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

  const handleCopy = async () => {
    if (!code) return;

    let success = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        success = true;
      } else {
        success = fallbackCopy(code);
      }
    } catch {
      success = fallbackCopy(code);
    }

    if (success) {
      setCopied(true);
      toast.success("Code copied");
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Unable to copy. Please try manually.");
    }
  };

  if (!code) return null;

  return (
    <div className="flex items-center gap-3 mt-4 mb-6">

      <div className="flex h-11 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition">

        {/* Discount */}
        {discountText && (
          <div className="flex items-center px-3 bg-slate-900 text-white text-xs font-semibold uppercase">
            {discountText}
          </div>
        )}

        {/* Code */}
        <div className="flex items-center px-4">
          <span className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            {code}
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          onKeyDown={(e) => e.key === "Enter" && handleCopy()}
          aria-label="Copy coupon code"
          className="px-3 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className="text-green-600"
              >
                <Check size={16} strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <Copy size={16} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Helper Text */}
      <span className="hidden md:block text-xs text-slate-400">
        Tap to copy
      </span>
    </div>
  );
}