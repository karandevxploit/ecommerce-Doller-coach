import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

/**
 * CouponBox
 * A premium-styled badge for showing and copying coupon codes.
 * @param {string} code - The coupon code to display.
 * @param {string} discountText - Optional discount text (e.g., "20% OFF").
 */
export default function CouponBox({ code, discountText }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Coupon Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code.");
    }
  };

  if (!code) return null;

  return (
    <div className="flex items-center gap-3 mt-4 mb-6 group">
      <div className="flex h-12 bg-white/80 backdrop-blur-md rounded-2xl border border-[#0f172a]/5 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-[#0f172a]/10">
        
        {/* DISCOUNT LABEL */}
        {discountText && (
          <div className="flex items-center px-4 bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest border-r border-white/10">
            {discountText}
          </div>
        )}

        {/* CODE DISPLAY */}
        <div className="flex items-center px-5 pr-2">
          <span className="text-xs font-black tracking-[0.25em] text-[#0f172a] uppercase">
            {code}
          </span>
        </div>

        {/* COPY INTERFACE */}
        <button
          onClick={handleCopy}
          className="relative px-4 flex items-center justify-center text-[#0f172a]/40 hover:text-[#0f172a] hover:bg-[#0f172a]/5 transition-all outline-none"
          title="Copy Code"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-green-600"
              >
                <Check size={16} strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="group-hover:scale-110 transition-transform"
              >
                <Copy size={16} strokeWidth={2.5} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      <div className="hidden md:flex flex-col">
         <span className="text-[7px] font-black text-gray-300 uppercase tracking-widest">Protocol</span>
         <span className="text-[9px] font-bold text-gray-400/80 uppercase">Tap to Apply</span>
      </div>
    </div>
  );
}
