import React, { useState, useEffect, useMemo } from "react";
import { Zap, Truck, Tag, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const OFFERS = [
  { text: "Free shipping on orders above ₹499", icon: Truck },
  { text: "Use code STREET30 to get 30% off", icon: Tag },
  { text: "New oversized collection is now live", icon: Zap },
  { text: "Secure payments and easy returns", icon: Sparkles }
];

export default function OfferStrip() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const offers = useMemo(() => {
    return Array.isArray(OFFERS) && OFFERS.length ? OFFERS : [];
  }, []);

  useEffect(() => {
    if (offers.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % offers.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [offers.length, isPaused]);

  if (!offers.length) return null;

  const CurrentIcon = offers[index].icon || Zap;

  return (
    <div
      className="bg-slate-50 h-10 flex items-center justify-center border-b border-slate-100 relative z-[110]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 px-4 text-center"
        >
          <CurrentIcon size={14} className="text-indigo-600 flex-shrink-0" />

          <span className="text-[11px] md:text-xs font-semibold text-slate-800 tracking-wide whitespace-nowrap">
            {offers[index].text}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}