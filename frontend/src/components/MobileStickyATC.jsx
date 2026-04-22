import { useState, useEffect, useCallback } from "react";
import { ShoppingBag, Zap } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { formatPrice } from "@/utils/format";

export default function MobileStickyATC({
   product,
   currentPricing,
   selectedSize,
   selectedVariant,
   onAddToCart,
   onBuyNow,
   threshold = 500
}) {
   const [isVisible, setIsVisible] = useState(false);
   const [loading, setLoading] = useState(false);
   const prefersReducedMotion = useReducedMotion();

   /* ---------------- SCROLL (OPTIMIZED) ---------------- */
   const handleScroll = useCallback(() => {
      const shouldShow = window.scrollY > threshold;
      setIsVisible((prev) => (prev !== shouldShow ? shouldShow : prev));
   }, [threshold]);

   useEffect(() => {
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
   }, [handleScroll]);

   if (!product) return null;

   const price = currentPricing?.price ?? product?.price ?? 0;
   const sizeValue =
      typeof selectedSize === "string" ? selectedSize : selectedSize?.size;

   const isDisabled = !selectedVariant || !sizeValue;

   const handleAdd = async () => {
      if (isDisabled) return;
      setLoading(true);
      try {
         await onAddToCart?.();
      } finally {
         setLoading(false);
      }
   };

   const handleBuy = async () => {
      if (isDisabled) return;
      setLoading(true);
      try {
         await onBuyNow?.();
      } finally {
         setLoading(false);
      }
   };

   return (
      <AnimatePresence>
         {isVisible && (
            <motion.div
               initial={prefersReducedMotion ? false : { y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               transition={{ duration: 0.25 }}
               role="region"
               aria-label="Quick purchase options"
               className="fixed bottom-0 left-0 right-0 z-[70] bg-white border-t border-slate-200 p-3 pb-6 lg:hidden shadow-lg"
            >
               <div className="flex items-center gap-3">

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                     <p className="text-xs font-medium text-slate-500 truncate">
                        {product?.title || "Product"}
                     </p>

                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-semibold text-slate-900">
                           {formatPrice(price)}
                        </span>

                        {selectedVariant && (
                           <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                              {selectedVariant?.colorName}
                           </span>
                        )}

                        {sizeValue && (
                           <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                              {sizeValue}
                           </span>
                        )}
                     </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 w-[55%]">

                     {/* Add to Cart */}
                     <button
                        onClick={handleAdd}
                        disabled={isDisabled || loading}
                        aria-disabled={isDisabled || loading}
                        className={`flex-1 h-10 rounded-lg flex items-center justify-center border text-sm transition ${isDisabled
                              ? "border-slate-200 text-slate-400 cursor-not-allowed"
                              : "border-slate-900 text-slate-900 hover:bg-slate-50"
                           }`}
                     >
                        <ShoppingBag size={16} />
                     </button>

                     {/* Buy Now */}
                     <button
                        onClick={handleBuy}
                        disabled={isDisabled || loading}
                        aria-disabled={isDisabled || loading}
                        className={`flex-[2] h-10 rounded-lg flex items-center justify-center gap-2 text-sm transition ${isDisabled
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-slate-900 text-white hover:bg-indigo-600"
                           }`}
                     >
                        {loading ? (
                           <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                        ) : (
                           <>
                              Buy now <Zap size={14} />
                           </>
                        )}
                     </button>

                  </div>
               </div>

               {/* Helper Text */}
               {isDisabled && (
                  <p className="text-xs text-red-500 mt-2">
                     Please select size and color
                  </p>
               )}
            </motion.div>
         )}
      </AnimatePresence>
   );
}