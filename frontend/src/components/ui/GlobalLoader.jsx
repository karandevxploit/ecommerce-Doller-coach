import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useReducedMotion } from "framer-motion";

/**
 * GlobalLoader
 * Accessible, performant loading screen for app-level transitions
 */
export default function GlobalLoader({ isVisible = false }) {
  const prefersReducedMotion = useReducedMotion();

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="global-loader"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{
          opacity: 0,
          transition: { duration: 0.5 }
        }}
        role="status"
        aria-live="polite"
        aria-label="Loading content"
        className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center"
      >
        {/* Background */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="absolute inset-0 bg-slate-50"
        />

        {/* Logo */}
        <div className="relative flex flex-col items-center gap-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.4
            }}
            className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-md"
          >
            <ShieldCheck size={28} />
          </motion.div>

          {/* Brand */}
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
              className="text-base font-bold text-slate-900"
            >
              Doller <span className="text-indigo-600">Coach</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.4 }}
              className="text-xs text-slate-500"
            >
              Loading your experience...
            </motion.p>
          </div>
        </div>

        {/* Progress Bar */}
        {!prefersReducedMotion && (
          <div className="absolute bottom-12 w-28 h-[2px] bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-full h-full bg-indigo-600"
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}