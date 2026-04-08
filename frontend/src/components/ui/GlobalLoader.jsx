import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";

/**
 * Global Loading Experience
 * High-fidelity, brand-aligned loading screen for initial mount and major navigation.
 */
export default function GlobalLoader({ isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            transition: { 
              duration: 0.8, 
              ease: [0.22, 1, 0.36, 1],
              when: "afterChildren" 
            }
          }}
          className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center pointer-events-none"
        >
          {/* Background Motif */}
          <motion.div 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className="absolute inset-0 bg-[#f1f5f9]/30"
          />

          {/* Logo & Signature */}
          <div className="relative flex flex-col items-center gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                duration: 0.6, 
                ease: [0.23, 1, 0.32, 1],
                type: "spring",
                bounce: 0.4
              }}
              className="w-16 h-16 bg-[#0f172a] rounded-3xl flex items-center justify-center text-white shadow-2xl"
            >
              <ShieldCheck size={32} strokeWidth={2.5} />
            </motion.div>

              <div className="text-center space-y-1">
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-lg font-black uppercase tracking-[0.3em] text-[#0f172a]"
                >
                  DOLLER <span className="text-blue-600">Coach</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400"
                >
                  (By Gangwani and Company)
                </motion.p>
              </div>
          </div>

          {/* Progress Indicator */}
          <div className="absolute bottom-16 w-32 h-[2px] bg-gray-100 overflow-hidden rounded-full">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="w-full h-full bg-[#0f172a]"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
